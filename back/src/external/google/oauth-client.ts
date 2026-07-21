import { google, Auth } from 'googleapis';
import { env } from '../../config/env';
import { GoogleTokens, GoogleTokenRefreshHandler } from './types';

const SCOPES = [
    // 'drive' (et non 'drive.file') requis pour écrire dans un dossier/Drive
    // partagé existant non créé par l'app (ex: DRIVE_CANDIDATS_NORD_FOLDER_ID).
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    // Lecture seule des Google Sheets (suivi d'absences Peda). Les comptes
    // connectés avant l'ajout de ce scope doivent refaire la connexion Google.
    'https://www.googleapis.com/auth/spreadsheets.readonly',
] as const;

/** `invalid_grant` = refresh_token mort. Google le remonte selon les cas dans
 *  `error`, `response.data.error` ou le message. */
export function isInvalidGrant(error: any): boolean {
    const codes = [error?.response?.data?.error, error?.error, error?.code, error?.message];
    return codes.some((c) => typeof c === 'string' && c.includes('invalid_grant'));
}

export class GoogleOAuthClient {
    static readonly SCOPES = SCOPES;

    private build(): Auth.OAuth2Client {
        return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
    }

    generateAuthUrl(state: string): string {
        return this.build().generateAuthUrl({
            access_type: 'offline',
            // Force Google à réémettre un refresh_token à chaque reconnexion.
            // Sans ça, seul le 1er consentement en renvoie un → tokens expirés en ~1h.
            prompt: 'consent',
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

            // Le refresh_token peut être révoqué côté Google (mot de passe changé,
            // accès retiré, jeton absent car consentement précédent sans `prompt`).
            // Toutes les requêtes googleapis passent par `client.request` : on
            // intercepte l'`invalid_grant` pour purger les jetons en base. Le compte
            // repasse alors "non connecté" et le front affiche l'invite de reconnexion.
            const request = client.request.bind(client);
            client.request = (async (opts: any) => {
                try {
                    return await request(opts);
                } catch (error: any) {
                    if (isInvalidGrant(error)) {
                        await onRefresh({ access_token: null, refresh_token: null });
                    }
                    throw error;
                }
            }) as typeof client.request;
        }
        return client;
    }
}

export const googleOAuth = new GoogleOAuthClient();
