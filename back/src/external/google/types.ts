export interface GoogleTokens {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expiry_date?: number;
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
}

export interface OAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface DriveListResponse {
    files: DriveFile[];
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
