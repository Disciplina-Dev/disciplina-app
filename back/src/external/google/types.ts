export interface GoogleTokens {
    access_token?: string | null;
    refresh_token?: string | null;
    token_type?: string;
    expiry_date?: number;
}

export type GoogleTokenRefreshHandler = (tokens: GoogleTokens) => void | Promise<void>;

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachment?: {
        filename: string;
        content: string;
        contentType?: string;
    };
}
