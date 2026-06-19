import { SendEmailOptions } from './types';

function encodeSubject(subject: string): string {
    if (!/[^ -~]/.test(subject)) return subject;
    return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
}

export function buildRawMessage(options: SendEmailOptions): string {
    const boundary = '==Disciplina==';
    const attachments = (options.attachments ?? []).filter((a) => a.content && a.filename);
    const subject = encodeSubject(options.subject);

    let message: string;

    if (attachments.length === 0) {
        message = [
            'MIME-Version: 1.0',
            `To: ${options.to}`,
            `Subject: ${subject}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            options.html,
        ].join('\r\n');
    } else {
        const attachmentParts = attachments.map((attachment) =>
            [
                `--${boundary}`,
                `Content-Type: ${attachment.contentType || 'application/octet-stream'}`,
                'Content-Transfer-Encoding: base64',
                `Content-Disposition: attachment; filename="${attachment.filename}"`,
                '',
                attachment.content,
                '',
            ].join('\r\n'),
        );

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
            ...attachmentParts,
            `--${boundary}--`,
        ].join('\r\n');
    }

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
