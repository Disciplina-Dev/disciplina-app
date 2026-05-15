import { google } from 'googleapis';
import { env } from '../../config/env';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { buildRawMessage } from './mime.builder';
import { SendEmailOptions } from './types';

const CALLBACK_URL = 'http://localhost:5173/auth/google';

export class GoogleGmailService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async sendEmail(
        userId: number,
        accessToken: string,
        refreshToken: string,
        options: SendEmailOptions,
    ): Promise<void> {
        const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, CALLBACK_URL);
        oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

        oauth2Client.on('tokens', async (tokens) => {
            await this.userRepository.updateTokens(
                userId,
                tokens.access_token ?? accessToken,
                tokens.refresh_token ?? refreshToken,
            );
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: buildRawMessage(options) },
        });
    }
}
