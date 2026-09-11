import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { appendRegion, getRegion, regionFromExternalSignature } from '../../../db/tenant';
import { env } from '../../../config/env';
import { resolveExternalRegion } from '../region';

const DEFAULT = env.DB_DEFAULT_TENANT;

describe('appendRegion', () => {
    it('suffixe avec la région passée', () => {
        expect(appendRegion('a'.repeat(128), 'annemasse')).toBe(`${'a'.repeat(128)}:annemasse`);
    });

    it('utilise la région courante par défaut', () => {
        expect(appendRegion('sig-example').endsWith(`:${getRegion()}`)).toBe(true);
    });
});

describe('regionFromExternalSignature', () => {
    it('lit la région suffixée', () => {
        expect(regionFromExternalSignature(`deadbeef:annemasse`)).toBe('annemasse');
        expect(regionFromExternalSignature(`deadbeef:reunion`)).toBe('reunion');
    });

    it('retombe sur le tenant par défaut sans suffixe', () => {
        expect(regionFromExternalSignature('deadbeef')).toBe(DEFAULT);
    });

    it('retombe sur le tenant par défaut pour un suffixe invalide', () => {
        expect(regionFromExternalSignature('deadbeef:martinique')).toBe(DEFAULT);
        expect(regionFromExternalSignature('deadbeef:')).toBe(DEFAULT);
    });
});

describe('resolveExternalRegion', () => {
    function run(req: Partial<Request>): string | undefined {
        let captured: string | undefined;
        const next: NextFunction = () => {
            captured = getRegion();
        };
        resolveExternalRegion(req as Request, {} as Response, next);
        return captured;
    }

    it('route selon la région de la signature dans les params', () => {
        expect(run({ params: { signature: 'hex:annemasse' }, body: {} })).toBe('annemasse');
        expect(run({ params: { signature: 'hex:reunion' }, body: {} })).toBe('reunion');
    });

    it('route selon la région de la signature dans le body (/inspect)', () => {
        expect(run({ params: {}, body: { signature: 'hex:annemasse' } })).toBe('annemasse');
    });

    it('retombe sur le tenant par défaut sans signature', () => {
        expect(run({ params: {}, body: {} })).toBe(DEFAULT);
    });

    it('retombe sur le tenant par défaut pour une signature legacy', () => {
        expect(run({ params: { signature: 'hex' }, body: {} })).toBe(DEFAULT);
    });
});