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
}

export function extractDriveFileId(webViewLink: string): string | null {
    const match = webViewLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}
