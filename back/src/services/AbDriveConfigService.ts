import { AbDriveConfig, AbDriveConfigRepository } from '../repositories/mongo/AbDriveConfigRepository';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { GoogleTokens } from '../external/google/types';
import { SECTORS, sectorFromRegion } from '../utils/sector';
import { JobRole, User } from '../types/user.types';
import { CompanyRegion } from '../types/needsAnalysisNoSql.types';
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

    /**
     * Archive un PDF d'AB dans le Drive, dans le dossier du secteur de l'AB
     * (région de l'entreprise), pas celui du commercial créateur.
     * Best-effort : ne jette jamais (hors chemin critique signature/envoi). Renvoie
     * le lien Drive en cas de succès, sinon null.
     *
     * @param region        secteur (région) de l'AB : NORD/OUEST/SUD. À défaut, repli
     *                      sur le secteur du commercial créateur.
     * @param kind          type de dossier (signé / non signé).
     * @param buffer        contenu du PDF.
     * @param filename      nom du fichier uploadé.
     * @param creatorId     id du commercial créateur de l'AB (source des jetons Google).
     * @param actingUserId  id de l'utilisateur à l'origine de l'action (source prioritaire des jetons Google).
     */
    async archiveAbPdf(
        region: CompanyRegion | undefined | null,
        kind: AbFolderKind,
        buffer: Buffer,
        filename: string,
        creatorId?: number,
        actingUserId?: number,
    ): Promise<string | null> {
        try {
            // Secteur de l'AB d'abord ; si absent, Nord-Est par défaut.
            const sector = sectorFromRegion(region) ?? 'Nord-Est';
            const creator = creatorId ? await this.userService.findById(creatorId) : null;
            const actingUser =
                actingUserId && actingUserId !== creatorId ? await this.userService.findById(actingUserId) : null;

            const folderId = await this.resolveFolder(sector, kind);
            if (!folderId) {
                logger.warn(
                    { sector, kind },
                    '[AbDrive] Aucun dossier Drive configuré pour ce secteur, archivage ignoré',
                );
                return null;
            }

            // Jetons Google : ceux de l'utilisateur courant en priorité, puis du créateur
            // de l'AB, sinon repli sur un commercial connecté.
            let driveUser: User | null = actingUser?.oauthToken ? actingUser : creator;
            if (!driveUser?.oauthToken) {
                driveUser = await this.userService.findFirstGoogleConnectedUser([JobRole.COMMERCIAL]);
                if (driveUser) {
                    logger.warn(
                        { creatorId, actingUserId, fallbackUserId: driveUser.id },
                        '[AbDrive] Repli sur un autre commercial connecté pour uploader sur le Drive',
                    );
                }
            }
            if (!driveUser?.oauthToken) {
                logger.warn('[AbDrive] Aucun compte Google connecté pour uploader sur le Drive, archivage ignoré');
                return null;
            }

            const drive = GoogleDriveService.fromTokens(
                { access_token: driveUser.oauthToken, refresh_token: driveUser.refreshToken ?? undefined },
                this.persistRefreshedTokens(driveUser.id),
            );
            const uploaded = await drive.uploadFile(filename, 'application/pdf', buffer, folderId);
            logger.info({ sector, kind, fileId: uploaded.id }, '[AbDrive] AB archivée sur le Drive');
            return uploaded.webViewLink;
        } catch (err) {
            logger.error({ err, creatorId, kind }, '[AbDrive] Échec archivage AB sur le Drive');
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
export function abDriveConfigToGql(config: AbDriveConfig) {
    return {
        sectorFolders: SECTORS.flatMap((sector) =>
            AB_FOLDER_KINDS.map((kind) => ({
                sector,
                kind,
                folderId: config.sectorFolders[abFolderKey(sector, kind)] ?? null,
            })),
        ),
    };
}
