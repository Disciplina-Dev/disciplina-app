import { AbDriveConfig, AbDriveConfigRepository } from '../repositories/mongo/AbDriveConfigRepository';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { GoogleTokens } from '../external/google/types';
import { SECTORS, Sector, primarySector } from '../utils/sector';
import { Role, User } from '../types/user.types';
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

    /** Dossier Drive cible pour une AB, selon le secteur du commercial et le type (signé / non signé). */
    async resolveFolder(sector: string | undefined, kind: AbFolderKind): Promise<string | undefined> {
        if (!sector) return undefined;
        const config = await this.repo.get();
        return config.sectorFolders[abFolderKey(sector, kind)] || undefined;
    }

    /**
     * Archive un PDF d'AB dans le Drive, dans le dossier du secteur du créateur.
     * Best-effort : ne jette jamais (hors chemin critique signature/envoi). Renvoie
     * le lien Drive en cas de succès, sinon null.
     *
     * @param creatorId  id du commercial créateur de l'AB (source du secteur + des jetons Google).
     */
    async archiveAbPdf(
        creatorId: number | undefined,
        kind: AbFolderKind,
        buffer: Buffer,
        filename: string,
    ): Promise<string | null> {
        try {
            const creator = creatorId ? await this.userService.findById(creatorId) : null;
            // Créateur sans secteur : rattaché au Nord (Nord-Est) par défaut.
            const sector: Sector = primarySector(creator?.sectors) ?? 'Nord-Est';

            const folderId = await this.resolveFolder(sector, kind);
            if (!folderId) {
                logger.warn(
                    { sector, kind },
                    '[AbDrive] Aucun dossier Drive configuré pour ce secteur, archivage ignoré',
                );
                return null;
            }

            // Jetons Google : ceux du créateur, sinon repli sur un commercial connecté.
            let driveUser: User | null = creator;
            if (!driveUser?.oauthToken) {
                driveUser = await this.userService.findFirstGoogleConnectedUser([
                    Role.COMMERCIAL,
                    Role.RESPONSABLE,
                    Role.ADMIN,
                ]);
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
