import { google, Auth } from 'googleapis';
import { OAuth2Config } from './types';

export function createOAuth2Client(config: OAuth2Config): Auth.OAuth2Client {
    return new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );
}

export function getOAuth2Client(): Auth.OAuth2Client {
    return createOAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.REDIRECT_URI || 'http://localhost:4000/auth/callback',
    });
}

export function getAuthScopes(): string[] {
    return [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify'
    ];
}