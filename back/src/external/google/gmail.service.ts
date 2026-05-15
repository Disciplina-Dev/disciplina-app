import { google } from 'googleapis';
import { buildRawMessage } from './mime.builder';
import { googleOAuth, GoogleOAuthClient } from './oauth-client';
import { GoogleTokens, GoogleTokenRefreshHandler, SendEmailOptions } from './types';

export class GoogleGmailService {
    constructor(private readonly oauth: GoogleOAuthClient = googleOAuth) {}

    async sendEmail(
        creds: GoogleTokens,
        options: SendEmailOptions,
        onTokenRefresh?: GoogleTokenRefreshHandler,
    ): Promise<void> {
        const auth = this.oauth.forCredentials(creds, onTokenRefresh);
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: buildRawMessage(options) },
        });
    }
}
