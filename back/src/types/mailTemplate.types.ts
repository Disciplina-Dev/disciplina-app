export type MailTemplateScope = 'rh' | 'commercial';

/** Pièce jointe d'un modèle : le fichier original est zippé et stocké sur le Drive de l'utilisateur. */
export interface MailTemplateAttachment {
    filename: string;        // nom original (ex: "plaquette.pdf")
    contentType: string;     // type MIME original
    driveFileId: string;     // id du .zip sur Drive
}

export interface MailTemplate {
    _id: string;
    user_id: number;
    scope: MailTemplateScope;
    name: string;
    subject: string;
    body: string;
    attachment: MailTemplateAttachment | null;
    created_at: Date;
    updated_at: Date;
}

/** Signature image d'un utilisateur (une par scope), stockée sur Drive. */
export interface MailSignature {
    _id: string;             // `${user_id}:${scope}`
    user_id: number;
    scope: MailTemplateScope;
    driveFileId: string;
    driveWebViewLink: string; // lien Drive du fichier signature
    filename: string;         // nom du fichier sur Drive
    contentType: string;
    updated_at: Date;
}
