import { randomUUID } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { MailTemplateModel, MailSignatureModel } from '../db/mongo/schemas/mailTemplate.schema';
import { MailTemplate, MailTemplateScope, MailTemplateAttachment } from '../types/mailTemplate.types';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { GoogleTokens } from '../external/google/types';
import { env } from '../config/env';

export class GoogleNotConnectedError extends Error {}
export class TemplateNotFoundError extends Error {}

/** Forme renvoyée au front : pas de _id Mongo brut, pas de contenu de PJ (juste les métadonnées). */
export interface MailTemplateDTO {
    id: string;
    name: string;
    subject: string;
    body: string;
    attachment: { filename: string; contentType: string } | null;
}

function toDTO(t: MailTemplate): MailTemplateDTO {
    return {
        id: t._id,
        name: t.name,
        subject: t.subject,
        body: t.body,
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

    // ── Modèles (CRUD) ───────────────────────────────────────────────────
    async list(userId: number, scope: MailTemplateScope): Promise<MailTemplateDTO[]> {
        const docs = await MailTemplateModel.find({ user_id: userId, scope })
            .sort({ created_at: 1 })
            .lean<MailTemplate[]>();
        return docs.map(toDTO);
    }

    async create(
        userId: number,
        scope: MailTemplateScope,
        data: { name: string; subject: string; body: string },
    ): Promise<MailTemplateDTO> {
        const now = new Date();
        const doc = await MailTemplateModel.create({
            _id: randomUUID(),
            user_id: userId,
            scope,
            name: data.name,
            subject: data.subject,
            body: data.body,
            attachment: null,
            created_at: now,
            updated_at: now,
        });
        return toDTO(doc.toObject() as MailTemplate);
    }

    async update(
        userId: number,
        id: string,
        data: { name: string; subject: string; body: string },
    ): Promise<MailTemplateDTO> {
        const doc = await MailTemplateModel.findOneAndUpdate(
            { _id: id, user_id: userId },
            { $set: { name: data.name, subject: data.subject, body: data.body, updated_at: new Date() } },
            { new: true },
        ).lean<MailTemplate>();
        if (!doc) throw new TemplateNotFoundError();
        return toDTO(doc);
    }

    async remove(userId: number, id: string): Promise<void> {
        const doc = await MailTemplateModel.findOne({ _id: id, user_id: userId }).lean<MailTemplate>();
        if (!doc) throw new TemplateNotFoundError();
        // Nettoyage de la PJ sur Drive (best-effort).
        if (doc.attachment) {
            try {
                const drive = await this.driveForUser(userId);
                await drive.deleteFile(doc.attachment.driveFileId);
            } catch {
                /* ignore : on supprime quand même le modèle */
            }
        }
        await MailTemplateModel.deleteOne({ _id: id, user_id: userId });
    }

    // ── Pièce jointe (1 par modèle, zippée sur Drive) ────────────────────
    async setAttachment(
        userId: number,
        id: string,
        filename: string,
        contentType: string,
        content: Buffer,
    ): Promise<MailTemplateDTO> {
        const doc = await MailTemplateModel.findOne({ _id: id, user_id: userId });
        if (!doc) throw new TemplateNotFoundError();

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
        const doc = await MailTemplateModel.findOne({ _id: id, user_id: userId });
        if (!doc) throw new TemplateNotFoundError();
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
        const doc = await MailTemplateModel.findOne({ _id: id, user_id: userId }).lean<MailTemplate>();
        if (!doc || !doc.attachment) throw new TemplateNotFoundError();
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
