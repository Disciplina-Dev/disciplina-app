import { describe, it, expect, afterEach } from 'vitest';
import { buildRawMessage } from '../mime.builder';
import {
    NO_REPLY_ADDRESS,
    NO_REPLY_FOOTER_HTML,
    NO_REPLY_FOOTER_TEXT,
    withNoReply,
} from '../no-reply';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
    process.env.NODE_ENV = value;
}

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

function decodeRaw(raw: string): string {
    return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

const BASE_OPTIONS = {
    to: 'dest@test.local',
    subject: 'Sujet',
    text: 'Corps texte',
};


describe('withNoReply', () => {
    it('ajoute replyTo et le pied de page quand la fonctionnalité est active', () => {
        const result = withNoReply({ ...BASE_OPTIONS, html: '<p>Bonjour</p>' });

        expect(result.replyTo).toBe(NO_REPLY_ADDRESS);
        expect(result.html.endsWith(NO_REPLY_FOOTER_HTML)).toBe(true);
        expect(result.text.endsWith(NO_REPLY_FOOTER_TEXT)).toBe(true);
        expect(result.to).toBe(BASE_OPTIONS.to);
        expect(result.subject).toBe(BASE_OPTIONS.subject);
    });

    it('ne duplique pas le pied de page déjà présent mais pose tout de même replyTo', () => {
        const result = withNoReply({
            ...BASE_OPTIONS,
            html: `<p>Bonjour</p>${NO_REPLY_FOOTER_HTML}`,
            text: `Corps${NO_REPLY_FOOTER_TEXT}`,
        });

        expect(result.replyTo).toBe(NO_REPLY_ADDRESS);
        expect(result.html.match(new RegExp(NO_REPLY_FOOTER_HTML, 'g'))?.length).toBe(1);
        expect(result.text.match(new RegExp(NO_REPLY_FOOTER_TEXT, 'g'))?.length).toBe(1);
    });
});

describe('buildRawMessage Reply-To', () => {
    it('émet un header Reply-To quand replyTo est fourni', () => {
        const raw = decodeRaw(buildRawMessage({ ...BASE_OPTIONS, html: '<p>x</p>', replyTo: NO_REPLY_ADDRESS }));

        expect(raw).toContain(`Reply-To: ${NO_REPLY_ADDRESS}`);
    });

    it("n'émet pas de header Reply-To sans replyTo", () => {
        const raw = decodeRaw(buildRawMessage({ ...BASE_OPTIONS, html: '<p>x</p>' }));

        expect(raw).not.toContain('Reply-To:');
    });

    it('neutralise les injections CRLF dans replyTo', () => {
        const raw = decodeRaw(
            buildRawMessage({
                ...BASE_OPTIONS,
                html: '<p>x</p>',
                replyTo: `${NO_REPLY_ADDRESS}\r\nBcc: evil@test.local`,
            }),
        );

        expect(raw).not.toMatch(/^Bcc:/m);
        expect(raw).toContain(`Reply-To: ${NO_REPLY_ADDRESS} Bcc: evil@test.local`);
    });
});
