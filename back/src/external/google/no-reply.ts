import { SendEmailOptions } from './types';

export const NO_REPLY_ADDRESS = 'noreply@disciplina.re';

export const NO_REPLY_FOOTER_TEXT =
    '\n\n---\nCeci est un message envoyé automatiquement par DISCIPLINA. Merci de ne pas répondre à cet e-mail.';

export const NO_REPLY_FOOTER_HTML =
    '<p style="font-size:12px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">Ceci est un message envoyé automatiquement par DISCIPLINA. Merci de ne pas répondre à cet e-mail.</p>';

export function isNoReplyEnabled(): boolean {
    return process.env.NODE_ENV === 'test';
}

export function withNoReply(options: SendEmailOptions): SendEmailOptions {
    if (!isNoReplyEnabled()) return options;
    return {
        ...options,
        replyTo: NO_REPLY_ADDRESS,
        html: options.html.includes(NO_REPLY_FOOTER_HTML) ? options.html : `${options.html}${NO_REPLY_FOOTER_HTML}`,
        text: options.text.includes(NO_REPLY_FOOTER_TEXT) ? options.text : `${options.text}${NO_REPLY_FOOTER_TEXT}`,
    };
}
