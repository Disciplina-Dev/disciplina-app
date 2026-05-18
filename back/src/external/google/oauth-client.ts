import { google, Auth } from 'googleapis';
import { env } from '../../config/env';
import { GoogleTokens, GoogleTokenRefreshHandler } from './types';

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
] as const;

export class GoogleOAuthClient {
    static readonly SCOPES = SCOPES;

    private build(): Auth.OAuth2Client {
        return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
    }

    generateAuthUrl(state: string): string {
        return this.build().generateAuthUrl({
            access_type: 'offline',
            scope: [...SCOPES],
            state,
        });
    }

    async exchangeCode(code: string): Promise<GoogleTokens> {
        const { tokens } = await this.build().getToken(code);
        return {
            access_token: tokens.access_token ?? null,
            refresh_token: tokens.refresh_token ?? null,
            token_type: tokens.token_type ?? undefined,
            expiry_date: tokens.expiry_date ?? undefined,
        };
    }

    forCredentials(creds: GoogleTokens, onRefresh?: GoogleTokenRefreshHandler): Auth.OAuth2Client {
        const client = this.build();
        client.setCredentials({
            access_token: creds.access_token ?? undefined,
            refresh_token: creds.refresh_token ?? undefined,
        });
        if (onRefresh) {
            client.on('tokens', (refreshed) => {
                void onRefresh({
                    access_token: refreshed.access_token ?? creds.access_token,
                    refresh_token: refreshed.refresh_token ?? creds.refresh_token,
                });
            });
        }
        return client;
    }
}

export const googleOAuth = new GoogleOAuthClient();
