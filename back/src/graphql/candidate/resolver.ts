import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { randomUUID } from 'crypto';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { CANDIDATE_TEMPLATES } from '../../types/candidate-templates';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';
import { camelToSnakeCase, candidateToGql } from '../../services/mappers/candidate.mapper';
import { logger } from '../../external/logger';
import { env } from '../../config/env';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';
import { CandidateFilters } from '../../repositories/mongo/CandidateRepository';

const candidateService = new CandidateService();
const userService = new UserService();

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

interface CreateCandidateInput {
    status: CandidateStatus;
    tpType: TitleProfessionalType;
    identity: { fullName: string; email: string; phone: string; [key: string]: any };
    [key: string]: any;
}

interface UpdateCandidateInput {
    [key: string]: any;
}

export const resolvers = {
    Query: {
        candidates: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const candidates = await candidateService.findAll();
            return candidates.map(candidateToGql);
        },
        candidatesPage: async (
            _: unknown,
            {
                first,
                after,
                search,
                filters: filtersInput,
            }: PaginationArgs & { search?: string; filters?: CandidateFilters },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const filters: CandidateFilters | undefined = filtersInput
                ? {
                      trainingSite: filtersInput.trainingSite,
                      status: filtersInput.status,
                      schoolLevel: filtersInput.schoolLevel,
                      drivingLicenseB: filtersInput.drivingLicenseB,
                      ageMin: filtersInput.ageMin,
                      ageMax: filtersInput.ageMax,
                      tpType: filtersInput.tpType,
                  }
                : undefined;
            const candidates = await candidateService.findPage(pageSize, after, search, filters);
            const conn = buildConnection(
                candidates,
                (c) => String(c._id),
                search?.trim() ? candidates.length : pageSize,
            );
            return {
                edges: conn.edges.map((edge) => ({ ...edge, node: candidateToGql(edge.node) })),
                pageInfo: conn.pageInfo,
            };
        },
        candidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const candidate = await candidateService.findById(id);
            if (!candidate) return null;
            try {
                return candidateToGql(candidate);
            } catch (err) {
                logger.error({ err, candidateId: id }, 'candidateToGql failed');
                throw err;
            }
        },
        candidateTemplate: async (_: unknown, { tpType }: { tpType: TitleProfessionalType }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const template = CANDIDATE_TEMPLATES[tpType];
            return {
                tpType: template.tp_type,
                hasEnglishLevel: template.has_english_level,
                availableSectors: template.available_sectors,
                availableExpectedSkills: template.available_expected_skills,
                defaultSkillsAssessment: template.default_skills_assessment.map((s) => ({
                    competence: s.competence,
                    level: s.level,
                })),
            };
        },
    },
    Mutation: {
        createCandidate: async (_: unknown, { input }: { input: CreateCandidateInput }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const id = randomUUID();
            const snakeInput = camelToSnakeCase(input);

            if (!snakeInput.skills_assessment || snakeInput.skills_assessment.length === 0) {
                const template = CANDIDATE_TEMPLATES[input.tpType];
                if (template) {
                    snakeInput.skills_assessment = template.default_skills_assessment;
                }
            }

            let newCandidate = await candidateService.create({
                _id: id,
                candidate_id: id,
                ...snakeInput,
            });

            try {
                const user = await userService.findById(context.user.id);
                if (user && user.oauthToken) {
                    const driveService = GoogleDriveService.fromTokens(
                        { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                        persistRefreshedTokens(user.id),
                    );

                    const folderName = `${newCandidate.identity.full_name} - ${id.substring(0, 8)}`;
                    const { id: folderId, webViewLink: folderLink } = await driveService.createFolder(
                        folderName,
                        env.DRIVE_CANDIDATS_NORD_FOLDER_ID,
                    );

                    await candidateService.update(id, { drive_folder_id: folderId, drive_folder_link: folderLink });
                    newCandidate.drive_folder_id = folderId;
                    newCandidate.drive_folder_link = folderLink;
                }
            } catch (error) {
                logger.error({ err: error }, 'Drive folder creation failed');
            }

            return candidateToGql(newCandidate);
        },

        updateCandidate: async (
            _: unknown,
            { id, input }: { id: string; input: UpdateCandidateInput },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const snakeInput = camelToSnakeCase(input);
            const updated = await candidateService.update(id, snakeInput);

            if (!updated) {
                throw new Error(`Candidate with id ${id} not found`);
            }

            return candidateToGql(updated);
        },

        deleteCandidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return candidateService.delete(id);
        },

        createCandidateDriveFolder: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);

            const candidate = await candidateService.findById(id);
            if (!candidate) throw new Error(`Candidate ${id} not found`);
            if (candidate.drive_folder_id) return candidateToGql(candidate);

            const user = await userService.findById(context.user.id);
            if (!user || !user.oauthToken) throw new Error('Google Drive non connecté pour cet utilisateur');

            const driveService = GoogleDriveService.fromTokens(
                { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                persistRefreshedTokens(user.id),
            );

            const folderName = `${candidate.identity.full_name} - ${id.substring(0, 8)}`;
            const { id: folderId, webViewLink: folderLink } = await driveService.createFolder(
                folderName,
                env.DRIVE_CANDIDATS_NORD_FOLDER_ID,
            );

            const updated = await candidateService.update(id, {
                drive_folder_id: folderId,
                drive_folder_link: folderLink,
            });
            if (!updated) throw new Error('Erreur lors de la mise à jour du candidat');
            return candidateToGql(updated);
        },
    },
};
