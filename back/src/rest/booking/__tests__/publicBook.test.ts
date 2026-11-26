import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';

// Parcours public « création de rendez-vous » (/booking/:slug) : l'invité doit
// fournir son prénom, son nom et son téléphone, en plus de l'email. La validation
// a lieu avant la résolution du slug : un corps incomplet répond 400, un corps
// complet mais un slug inconnu répond 404.

const BASE = `http://localhost:${env.API_PORT}/api/booking/public/slug-inexistant/book`;

function book(body: Record<string, unknown>): Promise<Response> {
    return fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const START = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('POST /api/booking/public/:slug/book — identité de l’invité', () => {
    it('refuse un corps sans prénom, nom ni téléphone (ancien contrat)', async () => {
        const res = await book({ start: START, name: 'Marie Dupont', email: 'guest@test.local' });
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: string }).error).toMatch(/firstName, lastName, phone/);
    });

    it('refuse un téléphone inexploitable', async () => {
        const res = await book({
            start: START,
            firstName: 'Marie',
            lastName: 'Dupont',
            phone: 'pas-un-numéro',
            email: 'guest@test.local',
        });
        expect(res.status).toBe(400);
    });

    it('refuse un prénom ou un nom vide', async () => {
        const res = await book({
            start: START,
            firstName: '   ',
            lastName: 'Dupont',
            phone: '0692000000',
            email: 'guest@test.local',
        });
        expect(res.status).toBe(400);
    });

    it('accepte un téléphone saisi avec espaces ou tirets', async () => {
        const res = await book({
            start: START,
            firstName: 'Marie',
            lastName: 'Dupont',
            phone: '0692 00-00.00',
            email: 'guest@test.local',
        });
        // Validation passée : on échoue plus loin, sur le slug inconnu.
        expect(res.status).toBe(404);
    });
});
