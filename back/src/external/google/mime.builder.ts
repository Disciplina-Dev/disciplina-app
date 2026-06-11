import { SendEmailOptions } from './types';

function encodeSubject(subject: string): string {
    if (!/[^ -~]/.test(subject)) return subject;
    return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
}

export function buildRawMessage(options: SendEmailOptions): string {
    const boundary = '==Disciplina==';
    const hasAttachment = !!(options.attachment?.content && options.attachment?.filename);
    const subject = encodeSubject(options.subject);

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
