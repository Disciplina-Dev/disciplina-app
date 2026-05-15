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
            fields: 'files(id, name, mimeType, size, modifiedTime)',
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
    ): Promise<string> {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(contentBuffer);

        const fileMetadata: any = {
            name: fileName,
        };
        if (parentFolderId) {
            fileMetadata.parents = [parentFolderId];
        }

        const media = {
            mimeType: mimeType,
            body: bufferStream,
        };

        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return file.data.webViewLink as string;
    }
}
