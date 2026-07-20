import { randomUUID } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { MailTemplateModel, MailSignatureModel } from '../db/mongo/schemas/mailTemplate.schema';
import { MailTemplate, MailTemplateScope, MailTemplateAttachment, PedaLevel } from '../types/mailTemplate.types';
import { PEDA_DEFAULT_TEMPLATES } from './pedaDefaultTemplates';
import { AppSettingsRepository } from '../repositories/mysql/AppSettingsRepository';
import { logger } from '../external/logger';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { GoogleTokens } from '../external/google/types';
import { env } from '../config/env';

export class GoogleNotConnectedError extends Error {}
export class TemplateNotFoundError extends Error {}
/** Un seul modèle peut porter un niveau de relance donné. */
export class DuplicatePedaLevelError extends Error {}

/**
 * Les modèles RH sont communs à tous les RH/responsables : ils sont stockés
 * sous un propriétaire partagé unique. (Le scope commercial reste par-user.)
 * La signature, elle, reste propre à chaque compte.
 */
export const SHARED_RH_USER_ID = 0;

/** Même principe pour les Pedas : modèles communs, propriétaire partagé dédié. */
export const SHARED_PEDA_USER_ID = -1;

/** Clé app_settings : les modèles Peda par défaut ont déjà été semés une fois. */
export const PEDA_TEMPLATES_SEEDED_KEY = 'peda_templates_seeded';

/** Forme renvoyée au front : pas de _id Mongo brut, pas de contenu de PJ (juste les métadonnées). */
export interface MailTemplateDTO {
    id: string;
    name: string;
    subject: string;
    body: string;
    /** Niveau de relance (scope `peda` uniquement) ; null sinon. */
    pedaLevel: PedaLevel | null;
    attachment: { filename: string; contentType: string } | null;
}

/** Données modifiables d'un modèle. `pedaLevel` n'est retenu que pour le scope `peda`. */
export interface MailTemplateInput {
    name: string;
    subject: string;
    body: string;
    pedaLevel?: PedaLevel | null;
}

function toDTO(t: MailTemplate): MailTemplateDTO {
    return {
        id: t._id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        pedaLevel: t.peda_level ?? null,
        attachment: t.attachment ? { filename: t.attachment.filename, contentType: t.attachment.contentType } : null,
    };
}

export class MailTemplateService {
    private userService = new UserService();

    // ── Drive ────────────────────────────────────────────────────────────
    private async driveForUser(userId: number): Promise<GoogleDriveService> {
        const user = await this.userService.findById(userId);
        if (!user || !user.oauthToken) throw new GoogleNotConnectedError('Google Drive non connecté');
        return GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            (refreshed: GoogleTokens) =>
                this.userService.updateGoogleTokens(
                    userId,
                    refreshed.access_token ?? null,
                    refreshed.refresh_token ?? null,
                ),
        );
    }

    // Propriétaire de stockage : partagé pour les scopes RH et Peda, sinon le user lui-même.
    private ownerFor(userId: number, scope: MailTemplateScope): number {
        if (scope === 'rh') return SHARED_RH_USER_ID;
        if (scope === 'peda') return SHARED_PEDA_USER_ID;
        return userId;
    }

    // Accès à un modèle : les modèles RH et Peda sont communs, les autres sont privés.
    private canAccess(doc: { scope: string; user_id: number }, userId: number): boolean {
        return doc.scope === 'rh' || doc.scope === 'peda' || doc.user_id === userId;
    }

    // ── Modèles (CRUD) ───────────────────────────────────────────────────
    async list(userId: number, scope: MailTemplateScope): Promise<MailTemplateDTO[]> {
        const docs = await MailTemplateModel.find({ user_id: this.ownerFor(userId, scope), scope })
            .sort({ created_at: 1 })
            .lean<MailTemplate[]>();
        return docs.map(toDTO);
    }

    /** Le niveau n'a de sens que pour le scope `peda` ; il est ignoré ailleurs. */
    private pedaLevelFor(scope: MailTemplateScope, level: PedaLevel | null | undefined): PedaLevel | null {
        return scope === 'peda' ? level ?? null : null;
    }

    /** Refuse deux modèles Peda sur le même niveau : la résolution serait ambiguë. */
    private async assertLevelFree(level: PedaLevel | null, exceptId?: string): Promise<void> {
        if (!level) return;
        const filter: Record<string, unknown> = { scope: 'peda', peda_level: level };
        if (exceptId) filter._id = { $ne: exceptId };
        if (await MailTemplateModel.exists(filter)) {
            throw new DuplicatePedaLevelError(`Un modèle porte déjà le niveau ${level}`);
        }
    }

    async create(userId: number, scope: MailTemplateScope, data: MailTemplateInput): Promise<MailTemplateDTO> {
        const now = new Date();
        const pedaLevel = this.pedaLevelFor(scope, data.pedaLevel);
        await this.assertLevelFree(pedaLevel);
        const doc = await MailTemplateModel.create({
            _id: randomUUID(),
            user_id: this.ownerFor(userId, scope),
            scope,
            name: data.name,
            subject: data.subject,
            body: data.body,
            peda_level: pedaLevel,
            attachment: null,
            created_at: now,
            updated_at: now,
        });
        return toDTO(doc.toObject() as MailTemplate);
    }

    async update(userId: number, id: string, data: MailTemplateInput): Promise<MailTemplateDTO> {
        const existing = await MailTemplateModel.findOne({ _id: id }).lean<MailTemplate>();
        if (!existing || !this.canAccess(existing, userId)) throw new TemplateNotFoundError();
        const pedaLevel = this.pedaLevelFor(existing.scope, data.pedaLevel);
        await this.assertLevelFree(pedaLevel, id);
        const doc = await MailTemplateModel.findOneAndUpdate(
            { _id: id },
            {
                $set: {
                    name: data.name,
                    subject: data.subject,
                    body: data.body,
                    peda_level: pedaLevel,
                    updated_at: new Date(),
                },
            },
            { new: true },
        ).lean<MailTemplate>();
        if (!doc) throw new TemplateNotFoundError();
        return toDTO(doc);
    }

    /** Modèle Peda associé à un niveau de relance, ou null s'il n'a pas été défini. */
    async findPedaTemplateByLevel(level: PedaLevel): Promise<MailTemplateDTO | null> {
        const doc = await MailTemplateModel.findOne({ scope: 'peda', peda_level: level }).lean<MailTemplate>();
        return doc ? toDTO(doc) : null;
    }

    /**
     * Sème les 4 modèles Peda par défaut (un par niveau) au premier démarrage.
     * Le flag `app_settings` garantit qu'un modèle supprimé volontairement par
     * un Peda ne réapparaît pas au redémarrage suivant.
     */
    async seedPedaDefaults(): Promise<void> {
        const settings = new AppSettingsRepository();
        if (await settings.get(PEDA_TEMPLATES_SEEDED_KEY)) return;

        let created = 0;
        for (const tpl of PEDA_DEFAULT_TEMPLATES) {
            // Un modèle déjà présent sur ce niveau (créé à la main) a la priorité.
            if (await MailTemplateModel.exists({ scope: 'peda', peda_level: tpl.pedaLevel })) continue;
            const now = new Date();
            await MailTemplateModel.create({
                _id: randomUUID(),
                user_id: SHARED_PEDA_USER_ID,
                scope: 'peda',
                name: tpl.name,
                subject: tpl.subject,
                body: tpl.body,
                peda_level: tpl.pedaLevel,
                attachment: null,
                created_at: now,
                updated_at: now,
            });
            created++;
        }
        await settings.set(PEDA_TEMPLATES_SEEDED_KEY, '1');
        logger.info({ created }, 'peda-templates: modèles par défaut semés');
    }

    async remove(userId: number, id: string): Promise<void> {
        const doc = await MailTemplateModel.findOne({ _id: id }).lean<MailTemplate>();
        if (!doc || !this.canAccess(doc, userId)) throw new TemplateNotFoundError();
        // Nettoyage de la PJ sur Drive (best-effort).
        if (doc.attachment) {
            try {
                const drive = await this.driveForUser(userId);
                await drive.deleteFile(doc.attachment.driveFileId);
            } catch {
                /* ignore : on supprime quand même le modèle */
            }
        }
        await MailTemplateModel.deleteOne({ _id: id });
    }

    // ── Pièce jointe (1 par modèle, zippée sur Drive) ────────────────────
    async setAttachment(
        userId: number,
        id: string,
        filename: string,
        contentType: string,
        content: Buffer,
    ): Promise<MailTemplateDTO> {
        const doc = await MailTemplateModel.findOne({ _id: id });
        if (!doc || !this.canAccess(doc, userId)) throw new TemplateNotFoundError();

        const drive = await this.driveForUser(userId);
        // Remplace l'ancienne PJ si présente.
        if (doc.attachment?.driveFileId) {
            try {
                await drive.deleteFile(doc.attachment.driveFileId);
            } catch {
                /* ignore */
            }
        }

        const zipped = gzipSync(content);
        const uploaded = await drive.uploadFile(
            `${filename}.gz`,
            'application/gzip',
            zipped,
            env.DRIVE_TEMPLATES_FOLDER_ID,
        );

        const attachment: MailTemplateAttachment = { filename, contentType, driveFileId: uploaded.id };
        doc.set({ attachment, updated_at: new Date() });
        await doc.save();
        return toDTO(doc.toObject() as MailTemplate);
    }

    async removeAttachment(userId: number, id: string): Promise<MailTemplateDTO> {
        const doc = await MailTemplateModel.findOne({ _id: id });
        if (!doc || !this.canAccess(doc, userId)) throw new TemplateNotFoundError();
        if (doc.attachment?.driveFileId) {
            try {
                const drive = await this.driveForUser(userId);
                await drive.deleteFile(doc.attachment.driveFileId);
            } catch {
                /* ignore */
            }
        }
        doc.set({ attachment: null, updated_at: new Date() });
        await doc.save();
        return toDTO(doc.toObject() as MailTemplate);
    }

    /** Télécharge le .zip depuis Drive et le décompresse → fichier original (base64) prêt à attacher. */
    async resolveAttachment(
        userId: number,
        id: string,
    ): Promise<{ filename: string; contentType: string; content: string }> {
        const doc = await MailTemplateModel.findOne({ _id: id }).lean<MailTemplate>();
        if (!doc || !this.canAccess(doc, userId) || !doc.attachment) throw new TemplateNotFoundError();
        const drive = await this.driveForUser(userId);
        const { buffer } = await drive.downloadFile(doc.attachment.driveFileId);
        const original = gunzipSync(buffer);
        return {
            filename: doc.attachment.filename,
            contentType: doc.attachment.contentType,
            content: original.toString('base64'),
        };
    }

    // ── Signature (une par user+scope, image sur Drive) ──────────────────
    async getSignature(userId: number, scope: MailTemplateScope): Promise<string | null> {
        const sig = await MailSignatureModel.findOne({ user_id: userId, scope }).lean<{
            driveFileId: string;
            contentType: string;
        }>();
        if (!sig) return null;
        const drive = await this.driveForUser(userId);
        const { buffer } = await drive.downloadFile(sig.driveFileId);
        return `data:${sig.contentType};base64,${buffer.toString('base64')}`;
    }

    /** Signature inline (`<img>` base64) à ajouter en bas d'un mail. '' si aucune. */
    async getSignatureHtml(userId: number, scope: MailTemplateScope): Promise<string> {
        const dataUrl = await this.getSignature(userId, scope).catch(() => null);
        if (!dataUrl) return '';
        return `<br/><img src="${dataUrl}" alt="signature" style="width:100%;max-width:480px;height:auto"/>`;
    }

    async setSignature(userId: number, scope: MailTemplateScope, contentType: string, content: Buffer): Promise<void> {
        const user = await this.userService.findById(userId);
        if (!user || !user.oauthToken) throw new GoogleNotConnectedError('Google Drive non connecté');
        const drive = await this.driveForUser(userId);
        const existing = await MailSignatureModel.findOne({ user_id: userId, scope }).lean<{ driveFileId: string }>();
        if (existing?.driveFileId) {
            try {
                await drive.deleteFile(existing.driveFileId);
            } catch {
                /* ignore */
            }
        }
        const ext = contentType.split('/')[1] || 'png';
        // Nom de fichier lisible sur Drive : "Signature DISCIPLINA - <Nom> (rh).<ext>"
        const safeName =
            `${user.firstName} ${user.lastName}`.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || `user${userId}`;
        const filename = `Signature DISCIPLINA - ${safeName} (${scope}).${ext}`;
        const uploaded = await drive.uploadFile(filename, contentType, content, env.DRIVE_TEMPLATES_FOLDER_ID);
        await MailSignatureModel.findOneAndUpdate(
            { _id: `${userId}:${scope}` },
            {
                $set: {
                    user_id: userId,
                    scope,
                    driveFileId: uploaded.id,
                    driveWebViewLink: uploaded.webViewLink,
                    filename,
                    contentType,
                    updated_at: new Date(),
                },
            },
            { upsert: true },
        );
    }

    async removeSignature(userId: number, scope: MailTemplateScope): Promise<void> {
        const sig = await MailSignatureModel.findOne({ user_id: userId, scope }).lean<{ driveFileId: string }>();
        if (!sig) return;
        try {
            const drive = await this.driveForUser(userId);
            await drive.deleteFile(sig.driveFileId);
        } catch {
            /* ignore */
        }
        await MailSignatureModel.deleteOne({ _id: `${userId}:${scope}` });
    }
}
