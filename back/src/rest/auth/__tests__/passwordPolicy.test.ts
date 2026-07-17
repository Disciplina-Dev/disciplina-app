import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../../config/env';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';

const URL = `http://localhost:${env.API_PORT}/api/auth/register`;

let counter = 0;

function register(passwordPlain: string) {
    counter += 1;
    return fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mintToken({ id: 1, email: 'admin@test.com', role: 'ADMIN' })}`,
        },
        body: JSON.stringify({
            email: `policy-${counter}@test.local`,
            firstName: 'Test',
            lastName: 'User',
            passwordPlain,
            role: 'RH',
        }),
    });
}

// register() passe par loginRateLimiter (10 / 15 min) : garder ce fichier sous ce plafond.
describe('password policy on register', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it.each([
        ['a', 'un seul caractère'],
        ['azertyuiopqs', 'ni majuscule ni chiffre'],
        ['AZERTYUIOPQS1', 'pas de minuscule'],
        ['Azertyuiopqs', 'pas de chiffre'],
        ['Azerty1', 'trop court malgré les classes'],
    ])('refuses %s (%s)', async (password) => {
        const res = await register(password);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Mot de passe trop faible');
    });

    it('accepts a compliant password', async () => {
        const res = await register('Azertyuiop12');
        expect(res.status).toBe(201);
    });
});
