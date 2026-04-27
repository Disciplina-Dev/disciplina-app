import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { DriveFile, GoogleTokens, DriveListResponse } from '../types';

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
}