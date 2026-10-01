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
    /** Copie carbone (visibles par tous les destinataires). Normalisés en minuscules côté appelant. */
    cc?: string[];
    subject: string;
    html: string;
    text: string;
    /** Valeur du header `List-Unsubscribe` (ex. `<mailto:rh@disciplina.re?subject=Desabonnement>`). Envois en nombre uniquement. */
    listUnsubscribe?: string;
    replyTo?: string;
    attachments?: {
        filename: string;
        content: string;
        contentType?: string;
    }[];
}
