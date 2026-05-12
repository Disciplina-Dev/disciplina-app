import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { DriveFile, GoogleTokens } from '../types';
import stream from 'stream';

export class DriveService {
    private drive;

    constructor(auth: Auth.OAuth2Client) {
        this.drive = google.drive({ version: 'v3', auth });
    }

    static fromTokens(tokens: GoogleTokens): DriveService {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);
        return new DriveService(oauth2Client);
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

    async uploadFile(fileName: string, mimeType: string, contentBuffer: Buffer, parentFolderId?: string): Promise<string> {
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