import { AbDriveConfig, AbDriveConfigRepository } from '../repositories/mongo/AbDriveConfigRepository';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { GoogleTokens } from '../external/google/types';
import { ANNEMASSE_DRIVE_SECTOR, DEFAULT_SECTOR, abDriveSectorsForTenant, sectorFromRegion } from '../utils/sector';
import { getRegion } from '../db/tenant';
import { JobRole, User } from '../types/user.types';
import { CompanyRegion, NeedsAnalysisStatus } from '../types/needsAnalysisNoSql.types';
import { logger } from '../external/logger';

/** Type de dossier d'archivage d'une AB : signé ou non signé. */
export type AbFolderKind = 'SIGNED' | 'UNSIGNED';
export const AB_FOLDER_KINDS: AbFolderKind[] = ['SIGNED', 'UNSIGNED'];

/** Clé de stockage d'un dossier dans sectorFolders : `${SECTEUR}_${KIND}`. */
export function abFolderKey(sector: string, kind: AbFolderKind): string {
    return `${sector}_${kind}`;
}

export class AbDriveConfigService {
    private repo = new AbDriveConfigRepository();
    private userService = new UserService();

    async getConfig(): Promise<AbDriveConfig> {
        return this.repo.get();
    }

    async updateConfig(input: AbDriveConfig): Promise<AbDriveConfig> {
        // Nettoie les valeurs vides pour ne pas stocker de chaînes blanches.
        const sectorFolders: Record<string, string> = {};
        for (const [k, v] of Object.entries(input.sectorFolders ?? {})) {
            const trimmed = (v ?? '').trim();
            if (trimmed) sectorFolders[k] = trimmed;
        }
        return this.repo.save({ sectorFolders });
    }

    /** Dossier Drive cible pour une AB, selon le secteur de l'AB et le type (signé / non signé). */
    async resolveFolder(sector: string | undefined, kind: AbFolderKind): Promise<string | undefined> {
        if (!sector) return undefined;
        const config = await this.repo.get();
        return config.sectorFolders[abFolderKey(sector, kind)] || undefined;
    }

    private async resolveCompanyFolder(
        drive: GoogleDriveService,
        parentFolderId: string,
        companyName: string,
    ): Promise<string> {
        const folderName = companyName.trim() || 'Entreprise';
        const existing = await drive.findFolder(folderName, parentFolderId);
        if (existing) return existing.id;

        const created = await drive.createFolder(folderName, parentFolderId);
        logger.info(
            { parentFolderId, folderName, folderId: created.id },
            '[AbDrive] Sous-dossier entreprise créé sur le Drive',
        );
        return created.id;
    }

    /**
     * Secteur Drive d'une AB : tenant Annemasse = dossier unique, sinon secteur
     * dérivé de la région de l'entreprise, avec repli sur le secteur par défaut.
     */
    private abSector(region: CompanyRegion | undefined | null): string {
        return getRegion() === 'annemasse' ? ANNEMASSE_DRIVE_SECTOR : (sectorFromRegion(region) ?? DEFAULT_SECTOR);
    }

    /**
     * Compte Google à utiliser pour le Drive : utilisateur à l'origine de
     * l'action en priorité, puis créateur de l'AB, puis repli sur le premier
     * commercial connecté (jetons rafraîchissables privilégiés).
     */
    private async resolveDrive(creatorId?: number, actingUserId?: number): Promise<GoogleDriveService | null> {
        const creator = creatorId ? await this.userService.findById(creatorId) : null;
        const actingUser =
            actingUserId && actingUserId !== creatorId ? await this.userService.findById(actingUserId) : null;

        const candidates = [actingUser, creator].filter((user): user is User => !!user?.oauthToken);
        let driveUser: User | null = candidates.find((user) => user.refreshToken) ?? candidates[0] ?? null;

        if (!driveUser?.refreshToken) {
            const fallback = await this.userService.findFirstGoogleConnectedUser([JobRole.COMMERCIAL]);
            if (fallback?.refreshToken || (!driveUser && fallback)) {
                if (driveUser) {
                    logger.warn(
                        { creatorId, actingUserId, fallbackUserId: fallback.id },
                        '[AbDrive] Jetons non rafraîchissables, repli sur un autre commercial connecté',
                    );
                }
                driveUser = fallback;
            }
        }
        if (!driveUser?.oauthToken) {
            logger.warn('[AbDrive] Aucun compte Google connecté pour accéder au Drive');
            return null;
        }

        return GoogleDriveService.fromTokens(
            { access_token: driveUser.oauthToken, refresh_token: driveUser.refreshToken ?? undefined },
            this.persistRefreshedTokens(driveUser.id),
        );
    }

    /** Nom de fichier d'un PDF d'AB archivé (nom stable et idempotent). */
    private isArchivedAbFile(filename: string, kind: AbFolderKind, abId: string): boolean {
        if (!filename.startsWith('Analyse_Besoin_') || !/\.pdf$/i.test(filename)) return false;
        return kind === 'SIGNED'
            ? filename.endsWith(`_${abId.slice(0, 8)}_Signee.pdf`)
            : filename.endsWith(`_${abId}.pdf`);
    }

    /**
     * Retrouve le PDF d'AB déjà archivé sur le Drive, pour les AB antérieures au
     * champ `ab_drive_url` (jamais persisté à l'archivage). Préfère la copie
     * signée, puis retombe sur la copie non signée, et enfin sur le dossier
     * Drive à défaut de fichier identifiable.
     */
    async resolveAbPdfLink(
        analysis: {
            id: string;
            status?: string | null;
            companyInfos?: { name?: string | null; sector?: CompanyRegion | null } | null;
            salerInfo?: { id?: number | null } | null;
        },
        actingUserId?: number,
    ): Promise<{ url: string; isFile: boolean } | null> {
        const drive = await this.resolveDrive(analysis.salerInfo?.id ?? undefined, actingUserId);
        if (!drive) return null;

        const sector = this.abSector(analysis.companyInfos?.sector ?? null);
        const companyName = analysis.companyInfos?.name?.trim();
        const kinds: AbFolderKind[] =
            analysis.status === NeedsAnalysisStatus.SIGNE ? ['SIGNED', 'UNSIGNED'] : ['UNSIGNED'];

        let folderUrl: string | null = null;
        try {
            for (const kind of kinds) {
                const folderId = await this.resolveFolder(sector, kind);
                if (!folderId) continue;
                folderUrl ??= `https://drive.google.com/drive/folders/${folderId}`;

                const parents: string[] = [];
                // AB signée : PDF rangé dans le sous-dossier de l'entreprise (comme l'archivage).
                if (kind === 'SIGNED' && companyName) {
                    const companyFolder = await drive.findFolder(companyName, folderId);
                    if (companyFolder) {
                        folderUrl = companyFolder.webViewLink;
                        parents.push(companyFolder.id);
                    }
                }
                parents.push(folderId);

                for (const parentId of parents) {
                    const files = await drive.listFolderFiles(parentId);
                    const match = files.find((file) => this.isArchivedAbFile(file.name, kind, analysis.id));
                    if (match?.webViewLink) {
                        return { url: match.webViewLink, isFile: true };
                    }
                }
            }
        } catch (err) {
            logger.warn({ err, abId: analysis.id }, "[AbDrive] Résolution du lien Drive de l'AB échouée");
        }

        return folderUrl ? { url: folderUrl, isFile: false } : null;
    }

    /**
     * Archive un PDF d'AB dans le Drive, dans le dossier du secteur de l'AB
     * (région de l'entreprise), pas celui du commercial créateur.
     * Best-effort : ne jette jamais (hors chemin critique signature/envoi). Renvoie
     * le lien Drive en cas de succès, sinon null.
     *
     * @param region        secteur (région) de l'AB : NORD/OUEST/SUD. À défaut, repli
     *                      sur le secteur par défaut du tenant (cf. `abSector`).
     * @param kind          type de dossier (signé / non signé).
     * @param buffer        contenu du PDF.
     * @param filename      nom du fichier uploadé.
     * @param companyName   nom de l'entreprise, utilisé pour regrouper les PDF signés dans un sous-dossier.
     * @param creatorId     id du commercial créateur de l'AB (source des jetons Google).
     * @param actingUserId  id de l'utilisateur à l'origine de l'action (source prioritaire des jetons Google).
     */
    async archiveAbPdf(
        region: CompanyRegion | undefined | null,
        kind: AbFolderKind,
        buffer: Buffer,
        filename: string,
        companyName?: string,
        creatorId?: number,
        actingUserId?: number,
    ): Promise<string | null> {
        try {
            // Secteur de l'AB d'abord ; à défaut, défaut du tenant
            // (Nord-Est pour Réunion, « Annemasse » pour Annemasse — un seul
            // dossier par type, pas un par secteur opérationnel).
            const sector = this.abSector(region);

            const folderId = await this.resolveFolder(sector, kind);
            if (!folderId) {
                logger.warn(
                    { sector, kind },
                    '[AbDrive] Aucun dossier Drive configuré pour ce secteur, archivage ignoré',
                );
                return null;
            }

            const drive = await this.resolveDrive(creatorId, actingUserId);
            if (!drive) {
                logger.warn('[AbDrive] Aucun compte Google connecté pour uploader sur le Drive, archivage ignoré');
                return null;
            }

            const targetFolderId =
                kind === 'SIGNED' && companyName?.trim()
                    ? await this.resolveCompanyFolder(drive, folderId, companyName)
                    : folderId;
            // Idempotence : la même AB peut être poussée deux fois (rejeu webhook,
            // renvoi en signature, deux comptes commerciaux). Le nom de fichier est
            // stable par AB → on supprime l'existant avant de réuploader au lieu
            // d'empiler des doublons (même pattern que `ab-to-drive` candidat).
            // Best-effort : un échec de listage n'empêche pas l'upload.
            try {
                const existing = await drive.listFolderFiles(targetFolderId);
                const duplicates = existing.filter((f) => f.name === filename);
                if (duplicates.length > 0) {
                    logger.info(
                        { sector, kind, filename, count: duplicates.length },
                        '[AbDrive] Removing duplicate file(s) before re-upload',
                    );
                    await Promise.all(duplicates.map((f) => drive.deleteFile(f.id)));
                }
            } catch (err) {
                logger.warn({ err, sector, kind, filename }, '[AbDrive] Duplicate check failed, uploading anyway');
            }
            const uploaded = await drive.uploadFile(filename, 'application/pdf', buffer, targetFolderId);
            logger.info({ sector, kind, fileId: uploaded.id }, '[AbDrive] AB archivée sur le Drive');
            return uploaded.webViewLink;
        } catch (err: any) {
            logger.error(
                {
                    err,
                    creatorId,
                    actingUserId,
                    kind,
                    filename,
                    status: err?.code ?? err?.response?.status,
                    googleError: err?.response?.data?.error,
                },
                '[AbDrive] Échec archivage AB sur le Drive',
            );
            return null;
        }
    }

    private persistRefreshedTokens = (userId: number) => async (refreshed: GoogleTokens) => {
        await this.userService.updateGoogleTokens(
            userId,
            refreshed.access_token ?? null,
            refreshed.refresh_token ?? null,
        );
    };
}

export const abDriveConfigService = new AbDriveConfigService();

/** Renvoie une entrée par couple secteur × type (même vide), pour piloter le formulaire de config. */
export function abDriveConfigToGql(config: AbDriveConfig, sectors?: string[]) {
    const list = sectors ?? abDriveSectorsForTenant(getRegion());
    return {
        sectorFolders: list.flatMap((sector) =>
            AB_FOLDER_KINDS.map((kind) => ({
                sector,
                kind,
                folderId: config.sectorFolders[abFolderKey(sector, kind)] ?? null,
            })),
        ),
    };
}
