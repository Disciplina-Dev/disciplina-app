import { authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { RhKpiService } from '../../services/RhKpiService';
import { CandidateHistoryService } from '../../services/CandidateHistoryService';
import { randomUUID } from 'crypto';
import { TitleProfessionalType, CandidateStatus, CandidateHistoryEntry } from '../../types/candidate.types';
import { CANDIDATE_TEMPLATES } from '../../types/candidate-templates';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { camelToSnakeCase, candidateToGql, offerToMatchedOfferGql } from '../../services/mappers/candidate.mapper';
import { logger } from '../../external/logger';
import { decryptSsn } from '../../external/crypto/ssn-cipher';
import { driveParentFolderForTp } from '../../external/google/drive.folders';
import { driveFolderConfigService, DRIVE_REGIONS, driveFolderKey } from '../../services/DriveFolderConfigService';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';
import {
    CandidateFilters,
    CandidateSearchField,
    encodeCandidateCursor,
} from '../../repositories/mongo/CandidateRepository';

/** Filtres reçus côté GraphQL : dates au format ISO (string), converties ensuite. */
type CandidateFiltersInput = Omit<CandidateFilters, 'createdAfter' | 'createdBefore'> & {
    statusIn?: string[];
    createdAfter?: string;
    createdBefore?: string;
    createdMissing?: boolean;
};

/**
 * Convertit une date de filtre ISO en `Date`. `endOfDay` étend la borne à
 * 23:59:59.999 pour inclure toute la journée sur une borne « avant / jusqu'au ».
 * Renvoie undefined si absente ou invalide (le filtre est alors ignoré).
 */
function parseFilterDate(iso: string | undefined, endOfDay: boolean): Date | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    if (endOfDay) d.setHours(23, 59, 59, 999);
    return d;
}
import { canAccessAllSectors, primarySector, regionFromSector, sanitizeSectors } from '../../utils/sector';

const candidateService = new CandidateService();
const userService = new UserService();
const rhKpiService = new RhKpiService();
const candidateHistoryService = new CandidateHistoryService();

/**
 * Secteurs effectivement visibles pour les stats agrégées : ADMIN/RESPONSABLE
 * voient tout (filtre client respecté) ; sinon on re-fetch le user (le JWT ne
 * porte pas les secteurs) et on borne la demande à ses secteurs. Un user sans
 * secteur assigné n'est pas restreint (convention historique).
 */
async function statsSectors(context: any, requested?: string[]): Promise<string[] | undefined> {
    if (canAccessAllSectors(context.user.permission)) return requested;
    const user = await userService.findById(Number(context.user.id));
    const own = sanitizeSectors(user?.sectors);
    if (own.length === 0) return requested;
    const ownSet = new Set<string>(own);
    const clamped = requested?.filter((s) => ownSet.has(s));
    // Demande hors périmètre → on ignore la sur-filtrer et on reste sur ses secteurs
    // (jamais de tableau vide : `stats([])` signifierait « tous » côté repository).
    return clamped && clamped.length > 0 ? clamped : own;
}

function candidateHistoryToGql(entry: CandidateHistoryEntry): object {
    return {
        id: entry._id,
        type: entry.type,
        description: entry.description,
        ownerEmail: entry.owner_email,
        createdAt: entry.created_at.toISOString(),
    };
}

/** Statuts candidat suivis dans les KPI RH (transition entrante = +1). */
const STATUS_KPI_COLUMN: Partial<Record<CandidateStatus, 'immersions' | 'contracts' | 'ruptures'>> = {
    [CandidateStatus.IMMERSING]: 'immersions',
    [CandidateStatus.CONTRACT]: 'contracts',
    [CandidateStatus.CANCELLED]: 'ruptures',
};

/**
 * Crédite +1 « entretien » au RH qui a réellement mené l'entretien : la personne
 * choisie dans le champ « Entretien fait par » de l'AB (synthesis.interviewed_by).
 * Le compteur va dans SON secteur. Aucun crédit si le champ est vide ou si le nom
 * ne correspond à aucun interviewer connu (ex. compte supprimé). Best-effort.
 */
async function creditInterviewKpi(interviewedBy?: string): Promise<void> {
    const name = interviewedBy?.trim();
    if (!name) return;
    try {
        const interviewers = await userService.findInterviewers();
        const match = interviewers.find((u) => `${u.firstName} ${u.lastName}`.trim() === name);
        if (!match) return;
        await rhKpiService.bump(match.id, primarySector(match.sectors) ?? '', new Date(), {
            interviews_attended: 1,
        });
    } catch (error) {
        logger.error({ err: error, interviewedBy }, 'rh_kpi interview bump failed');
    }
}

interface CreateCandidateInput {
    status: CandidateStatus;
    tpTypes: TitleProfessionalType[];
    identity: { fullName: string; email: string; phone: string; [key: string]: any };
    [key: string]: any;
}

interface UpdateCandidateInput {
    [key: string]: any;
}

function driveFolderConfigToGql(config: { rootFolderId: string | null; tpFolders: Record<string, string> }) {
    return {
        rootFolderId: config.rootFolderId ?? null,
        // Toujours renvoyer une entrée par couple TP × région (même vide) pour piloter le formulaire.
        tpFolders: Object.values(TitleProfessionalType).flatMap((tp) =>
            DRIVE_REGIONS.map((region) => ({
                tp,
                region,
                folderId: config.tpFolders[driveFolderKey(tp, region)] ?? null,
            })),
        ),
    };
}

export const resolvers = {
    Query: {
        candidates: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const candidates = await candidateService.findAll();
            return candidates.map(candidateToGql);
        },
        candidatesPage: async (
            _: unknown,
            {
                first,
                after,
                search,
                searchField,
                filters: filtersInput,
            }: PaginationArgs & {
                search?: string;
                searchField?: CandidateSearchField;
                filters?: CandidateFiltersInput;
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const searchFieldValue: CandidateSearchField | undefined = searchField ?? undefined;
            const filters: CandidateFilters | undefined = filtersInput
                ? {
                      trainingSite: filtersInput.trainingSite,
                      status: filtersInput.statusIn?.length ? undefined : filtersInput.status,
                      statusIn: filtersInput.statusIn?.length ? filtersInput.statusIn : undefined,
                      schoolLevel: filtersInput.schoolLevel,
                      drivingLicenseB: filtersInput.drivingLicenseB,
                      hasVehicle: filtersInput.hasVehicle,
                      sex: filtersInput.sex?.trim() || undefined,
                      ageMin: filtersInput.ageMin,
                      ageMax: filtersInput.ageMax,
                      tpType: filtersInput.tpType?.length ? filtersInput.tpType : undefined,
                      // Bornage défensif : on ignore les tableaux vides et on plafonne
                      // la taille pour éviter un `$in` démesuré. Les secteurs sont des
                      // chaînes libres → on écarte les valeurs non-string/vides.
                      geographicMobility: filtersInput.geographicMobility?.length
                          ? filtersInput.geographicMobility.slice(0, 30)
                          : undefined,
                      desiredSectors: filtersInput.desiredSectors?.length
                          ? filtersInput.desiredSectors
                                .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
                                .slice(0, 50)
                          : undefined,
                      createdAfter: parseFilterDate(filtersInput.createdAfter, false),
                      createdBefore: parseFilterDate(filtersInput.createdBefore, true),
                      createdMissing: filtersInput.createdMissing || undefined,
                      interviewedBy: filtersInput.interviewedBy?.trim() || undefined,
                  }
                : undefined;
            const candidates = await candidateService.findPage(pageSize, after, search, filters, searchFieldValue);
            const totalCount = await candidateService.countPage(search, filters, searchFieldValue);
            const conn = buildConnection(
                candidates,
                encodeCandidateCursor,
                search?.trim() ? candidates.length : pageSize,
            );
            return {
                edges: conn.edges.map((edge) => ({ ...edge, node: candidateToGql(edge.node) })),
                pageInfo: conn.pageInfo,
                totalCount,
            };
        },
        candidateStats: async (_: unknown, { sectors }: { sectors?: string[] }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return candidateService.stats(await statsSectors(context, sectors));
        },
        candidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const candidate = await candidateService.findById(id);
            if (!candidate) return null;
            // Backfill unique de la date de création pour les fiches antérieures au champ.
            if (!candidate.created_at) {
                try {
                    const backfilled = await candidateService.backfillCreatedAt(id);
                    if (backfilled) candidate.created_at = backfilled;
                } catch (err) {
                    logger.error({ err, candidateId: id }, 'created_at backfill failed');
                }
            }
            try {
                return candidateToGql(candidate);
            } catch (err) {
                logger.error({ err, candidateId: id }, 'candidateToGql failed');
                throw err;
            }
        },
        // Vérification de doublon en direct : existe-t-il déjà une fiche pour cet email ?
        candidateByEmail: async (_: unknown, { email }: { email: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const existing = await candidateService.findByEmail(email);
            return existing
                ? { exists: true, id: existing._id, fullName: existing.identity.full_name }
                : { exists: false, id: null, fullName: null };
        },
        matchCandidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const candidate = await candidateService.findById(id);
            if (!candidate) throw new Error(`Candidate ${id} not found`);
            const matchedOffers = await candidateService.matchOffers(id);
            return {
                ...candidateToGql(candidate),
                matchedOffers: matchedOffers.map((o) => offerToMatchedOfferGql(o, id)),
            };
        },
        candidateHistory: async (_: unknown, { candidateId }: { candidateId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const entries = await candidateHistoryService.findByCandidate(candidateId);
            return entries.map(candidateHistoryToGql);
        },
        driveFolderConfig: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const config = await driveFolderConfigService.getConfig();
            return driveFolderConfigToGql(config);
        },
        unmaskCandidateSsn: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const candidate = await candidateService.findById(id);
            const ssn = candidate?.identity?.social_security_number;
            if (!ssn) return null;
            try {
                return decryptSsn(ssn);
            } catch (err) {
                logger.error({ err, candidateId: id }, 'SSN unmask failed');
                throw new Error(
                    'Le numéro de sécurité sociale de cette fiche est illisible : il a été enregistré avant la mise en place du chiffrement, ou avec une autre clé. Une migration est nécessaire.',
                );
            }
        },
    },
    Mutation: {
        createCandidate: async (_: unknown, { input }: { input: CreateCandidateInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);

            // Doublon : une fiche existe déjà pour cette adresse mail.
            const email = input.identity?.email?.trim();
            if (email) {
                const existing = await candidateService.findByEmail(email);
                if (existing) {
                    throw new Error(
                        `Une fiche candidat est déjà enregistrée pour l'adresse ${email} (${existing.identity.full_name}).`,
                    );
                }
            }

            if (!input.consentments?.dataProcessing) {
                throw new Error('Le consentement au traitement des données est obligatoire.');
            }

            const id = randomUUID();
            const snakeInput = camelToSnakeCase(input);
            // Multi-sites : garde le single legacy training_site = 1er site choisi
            // (utilisé pour le routage Drive / stats / filtres).
            if (Array.isArray(snakeInput.training_sites)) {
                snakeInput.training_site = snakeInput.training_sites[0] ?? undefined;
            }
            if (!snakeInput.skills_assessment || snakeInput.skills_assessment.length === 0) {
                const template = CANDIDATE_TEMPLATES[input.tpTypes[0]];
                if (template) {
                    snakeInput.skills_assessment = template.default_skills_assessment;
                }
            }

            // Owner = créateur du dossier. Son secteur (snapshot) route le dossier Drive.
            const creator = await userService.findById(context.user.id);
            const ownerSector = primarySector(creator?.sectors);
            const owner = creator
                ? {
                      user_id: creator.id,
                      name: `${creator.firstName} ${creator.lastName}`.trim(),
                      sector: ownerSector,
                  }
                : undefined;

            let newCandidate = await candidateService.create({
                _id: id,
                candidate_id: id,
                owner,
                created_at: new Date(),
                ...snakeInput,
            });

            // KPI RH : le +1 « entretien » va au RH qui a mené l'entretien (champ
            // « Entretien fait par »), pas au créateur du dossier. Rien si aucun
            // interviewer n'est choisi (ex. création rapide nom/mail/tél).
            await creditInterviewKpi(snakeInput.synthesis?.interviewed_by);

            try {
                if (creator && creator.oauthToken) {
                    const driveService = GoogleDriveService.fromTokens(
                        { access_token: creator.oauthToken, refresh_token: creator.refreshToken ?? undefined },
                        userService.googleTokenPersister(creator.id),
                    );

                    const folderName = `${newCandidate.identity.full_name} - ${id.substring(0, 8)}`;
                    const { id: folderId, webViewLink: folderLink } = await driveService.createFolder(
                        folderName,
                        await driveParentFolderForTp(
                            newCandidate.tp_types?.[0],
                            newCandidate.training_site,
                            regionFromSector(ownerSector),
                        ),
                    );

                    await candidateService.update(id, { drive_folder_id: folderId, drive_folder_link: folderLink });
                    newCandidate.drive_folder_id = folderId;
                    newCandidate.drive_folder_link = folderLink;
                }
            } catch (error) {
                logger.error({ err: error }, 'Drive folder creation failed');
            }

            const matchedOffers = await candidateService.matchOffers(id);
            return {
                ...candidateToGql(newCandidate),
                matchedOffers: matchedOffers.map((o) => offerToMatchedOfferGql(o, id)),
            };
        },

        updateCandidate: async (
            _: unknown,
            { id, input }: { id: string; input: UpdateCandidateInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const snakeInput = camelToSnakeCase(input);
            // Multi-sites : garde le single legacy training_site = 1er site choisi.
            if (Array.isArray(snakeInput.training_sites)) {
                snakeInput.training_site = snakeInput.training_sites[0] ?? undefined;
            }
            // État avant mise à jour : statut (transitions KPI) + interviewer (crédit
            // entretien une seule fois). On ne relit le dossier que si l'un des deux change.
            const newInterviewer = snakeInput.synthesis?.interviewed_by?.trim();
            const previous = snakeInput.status || newInterviewer ? await candidateService.findById(id) : undefined;
            const previousStatus = previous?.status;
            const previousInterviewer = previous?.synthesis?.interviewed_by?.trim();
            const updated = await candidateService.update(id, snakeInput);

            if (!updated) {
                throw new Error(`Candidate with id ${id} not found`);
            }

            // KPI RH : transition de statut vers immersion / contrat / rupture (compté pour le RH agissant).
            const column = STATUS_KPI_COLUMN[updated.status];
            if (column && snakeInput.status && previousStatus !== updated.status) {
                await rhKpiService.bump(Number(context.user.id), updated.owner?.sector ?? '', new Date(), {
                    [column]: 1,
                });
            }

            // KPI RH : entretien crédité à l'interviewer quand le champ passe de vide →
            // renseigné (une seule fois). Une AB déjà attribuée qu'on ré-édite ne recompte pas.
            if (newInterviewer && !previousInterviewer) {
                await creditInterviewKpi(newInterviewer);
            }

            return candidateToGql(updated);
        },

        deleteCandidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return candidateService.delete(id);
        },

        createCandidateDriveFolder: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);

            const candidate = await candidateService.findById(id);
            if (!candidate) throw new Error(`Candidate ${id} not found`);
            if (candidate.drive_folder_id) return candidateToGql(candidate);

            const user = await userService.findById(context.user.id);
            if (!user || !user.oauthToken) throw new Error('Google Drive non connecté pour cet utilisateur');

            const driveService = GoogleDriveService.fromTokens(
                { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                userService.googleTokenPersister(user.id),
            );

            // Secteur courant de l'utilisateur agissant (prioritaire), sinon snapshot owner, sinon site de formation.
            const actingSector = primarySector(user.sectors);
            const ownerSector = actingSector ?? candidate.owner?.sector;

            const folderName = `${candidate.identity.full_name} - ${id.substring(0, 8)}`;
            const { id: folderId, webViewLink: folderLink } = await driveService.createFolder(
                folderName,
                await driveParentFolderForTp(
                    candidate.tp_types?.[0],
                    candidate.training_site,
                    regionFromSector(ownerSector),
                ),
            );

            // Backfill / rafraîchit l'owner (utile pour les candidats créés avant la feature secteurs).
            const owner = candidate.owner
                ? { ...candidate.owner, sector: ownerSector }
                : { user_id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), sector: ownerSector };

            const updated = await candidateService.update(id, {
                drive_folder_id: folderId,
                drive_folder_link: folderLink,
                owner,
            });
            if (!updated) throw new Error('Erreur lors de la mise à jour du candidat');
            return candidateToGql(updated);
        },

        addCandidateHistoryEntry: async (
            _: unknown,
            { candidateId, description }: { candidateId: string; description: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const entry = await candidateHistoryService.recordManual(candidateId, description, context.user.email);
            return candidateHistoryToGql(entry);
        },

        deleteCandidateHistoryEntry: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return candidateHistoryService.deleteOwnedEntry(id, context.user.email);
        },

        updateDriveFolderConfig: async (
            _: unknown,
            {
                input,
            }: {
                input: {
                    rootFolderId?: string | null;
                    tpFolders: { tp: string; region: string; folderId?: string | null }[];
                };
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const tpFolders: Record<string, string> = {};
            for (const { tp, region, folderId } of input.tpFolders ?? []) {
                if (folderId) tpFolders[driveFolderKey(tp, region)] = folderId;
            }
            const updated = await driveFolderConfigService.updateConfig({
                rootFolderId: input.rootFolderId ?? null,
                tpFolders,
            });
            return driveFolderConfigToGql(updated);
        },
    },
};
