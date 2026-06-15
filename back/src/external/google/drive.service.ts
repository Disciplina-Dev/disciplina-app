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
        });
        return (response.data.files || []) as DriveFile[];
    }

    async deleteFile(fileId: string): Promise<void> {
        await this.drive.files.delete({ fileId });
    }

    async listFolderFiles(folderId: string): Promise<DriveFile[]> {
        const response = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
            orderBy: 'modifiedTime desc',
        });
        return (response.data.files || []) as DriveFile[];
    }

    async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
        const fileMetadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentFolderId) {
            fileMetadata.parents = [parentFolderId];
        }
        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        return file.data.id as string;
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
        });

        return { id: file.data.id as string, webViewLink: file.data.webViewLink as string };
    }
}
