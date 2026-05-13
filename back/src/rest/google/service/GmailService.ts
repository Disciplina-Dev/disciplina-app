import { google } from 'googleapis';
import { env } from '../../../config/env';
import { UserRepository } from '../../../repositories/mysql/UserRepository';

const CALLBACK_URL = 'http://localhost:5173/auth/google';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachment?: {
        filename: string;
        content: string; // base64
        contentType?: string;
    };
}

export class GmailService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    private encodeSubject(subject: string): string {
        if (!/[^\x00-\x7F]/.test(subject)) return subject;
        return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    }

    private buildRawMessage(options: SendEmailOptions): string {
        const boundary = '==Disciplina==';
        const hasAttachment = !!(options.attachment?.content && options.attachment?.filename);
        const subject = this.encodeSubject(options.subject);

        let message: string;

        if (!hasAttachment) {
            message = [
                'MIME-Version: 1.0',
                `To: ${options.to}`,
                `Subject: ${subject}`,
                'Content-Type: text/html; charset=utf-8',
                '',
                options.html,
            ].join('\r\n');
        } else {
            message = [
                'MIME-Version: 1.0',
                `To: ${options.to}`,
                `Subject: ${subject}`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset=utf-8',
                '',
                options.html,
                '',
                `--${boundary}`,
                `Content-Type: ${options.attachment!.contentType || 'application/octet-stream'}`,
                'Content-Transfer-Encoding: base64',
                `Content-Disposition: attachment; filename="${options.attachment!.filename}"`,
                '',
                options.attachment!.content,
                '',
                `--${boundary}--`,
            ].join('\r\n');
        }

        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
            requestBody: { raw: this.buildRawMessage(options) },
        });
    }
}
