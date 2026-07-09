import { google, Auth } from 'googleapis';
import stream from 'stream';
import { googleOAuth, GoogleOAuthClient } from './oauth-client';
import { DriveFile, GoogleTokens, GoogleTokenRefreshHandler } from './types';

export class GoogleDriveService {
    private drive;

    constructor(auth: Auth.OAuth2Client) {
        this.drive = google.drive({ version: 'v3', auth });
    }

    static fromTokens(
        creds: GoogleTokens,
        onRefresh?: GoogleTokenRefreshHandler,
        oauth: GoogleOAuthClient = googleOAuth,
    ): GoogleDriveService {
        return new GoogleDriveService(oauth.forCredentials(creds, onRefresh));
    }

    async listFiles(): Promise<DriveFile[]> {
        const response = await this.drive.files.list({
            fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        return (response.data.files || []) as DriveFile[];
    }

    async deleteFile(fileId: string): Promise<void> {
        await this.drive.files.delete({ fileId, supportsAllDrives: true });
    }

    async listFolderFiles(folderId: string): Promise<DriveFile[]> {
        const response = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
            orderBy: 'modifiedTime desc',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        return (response.data.files || []) as DriveFile[];
    }

    async createFolder(folderName: string, parentFolderId?: string): Promise<{ id: string; webViewLink: string }> {
        const fileMetadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentFolderId) {
            fileMetadata.parents = [parentFolderId];
        }
        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });
        return { id: file.data.id as string, webViewLink: file.data.webViewLink as string };
    }

    async uploadFile(
        fileName: string,
        mimeType: string,
        contentBuffer: Buffer,
        parentFolderId?: string,
    ): Promise<{ webViewLink: string; id: string }> {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(contentBuffer);

        const fileMetadata: any = { name: fileName };
        if (parentFolderId) fileMetadata.parents = [parentFolderId];

        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            media: { mimeType, body: bufferStream },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });

        return { id: file.data.id as string, webViewLink: file.data.webViewLink as string };
    }

    async downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const response = await this.drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' },
        );
        return {
            buffer: Buffer.from(response.data as ArrayBuffer),
            mimeType: (response.headers['content-type'] as string) || 'application/pdf',
        };
    }

    async getFileMeta(fileId: string): Promise<{ id: string; name: string; mimeType: string }> {
        const response = await this.drive.files.get({
            fileId,
            fields: 'id, name, mimeType',
            supportsAllDrives: true,
        });
        return response.data as { id: string; name: string; mimeType: string };
    }

    /** Exporte un Google Doc natif (Docs/Sheets/Slides) vers un format téléchargeable. */
    async exportFile(fileId: string, mimeType = 'application/pdf'): Promise<{ buffer: Buffer; mimeType: string }> {
        const response = await this.drive.files.export(
            { fileId, mimeType },
            { responseType: 'arraybuffer' },
        );
        return { buffer: Buffer.from(response.data as ArrayBuffer), mimeType };
    }

    /** Types Office / OpenDocument convertibles en Google-natif (donc exportables en PDF). */
    private static readonly CONVERTIBLE_TO_GOOGLE: Record<string, string> = {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            'application/vnd.google-apps.document',
        'application/msword': 'application/vnd.google-apps.document',
        'application/vnd.oasis.opendocument.text': 'application/vnd.google-apps.document',
        'application/rtf': 'application/vnd.google-apps.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            'application/vnd.google-apps.spreadsheet',
        'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
        'application/vnd.oasis.opendocument.spreadsheet': 'application/vnd.google-apps.spreadsheet',
        'text/csv': 'application/vnd.google-apps.spreadsheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            'application/vnd.google-apps.presentation',
        'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
        'application/vnd.oasis.opendocument.presentation': 'application/vnd.google-apps.presentation',
    };

    /** True si le type Office peut être converti en PDF via Google Drive. */
    static isConvertibleToPdf(mimeType: string): boolean {
        return mimeType in GoogleDriveService.CONVERTIBLE_TO_GOOGLE;
    }

    /**
     * Convertit un fichier Office/OpenDocument en PDF via Google Drive :
     * copie temporaire convertie en Google-natif → export PDF → suppression best-effort de la copie.
     */
    async convertToPdf(fileId: string, sourceMimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const googleType = GoogleDriveService.CONVERTIBLE_TO_GOOGLE[sourceMimeType];
        if (!googleType) return this.downloadFile(fileId);

        const meta = await this.getFileMeta(fileId);
        const copy = await this.drive.files.copy({
            fileId,
            requestBody: { name: `__preview_${meta.name}`, mimeType: googleType },
            fields: 'id',
            supportsAllDrives: true,
        });
        const tempId = copy.data.id as string;
        try {
            return await this.exportFile(tempId, 'application/pdf');
        } finally {
            await this.deleteFile(tempId).catch(() => {});
        }
    }
}

export function extractDriveFileId(webViewLink: string): string | null {
    const match = webViewLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}
