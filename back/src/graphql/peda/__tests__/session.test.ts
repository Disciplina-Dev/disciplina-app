import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/peda`;

function pedaAuth() {
    return mintAuthCookies({ id: 1, email: 'peda@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
}

function gqlFetch(auth: { cookieHeader: string; csrfHeader: string }, query: string, variables?: unknown) {
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: auth.cookieHeader,
            'x-csrf-token': auth.csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    }).then((res) => res.json());
}

const SESSION_FIELDS = `id nom filiere jourCours dateDebut dateFin alternantCount`;

function sessionInput(suffix: string | number, overrides: Record<string, unknown> = {}) {
    return {
        nom: `BTS MCO ${suffix} Groupe A`,
        filiere: 'Management Commercial',
        jourCours: 'Lundi',
        dateDebut: '2026-09-01',
        dateFin: '2027-06-30',
        ...overrides,
    };
}

function alternantInput(suffix: string | number, overrides: Record<string, unknown> = {}) {
    return {
        firstName: `Léa-${suffix}`,
        lastName: `Martin-${suffix}`,
        session: `LIBRE-${suffix}`,
        email: `session-lea-${suffix}@test.local`,
        phone: '0692000000',
        company: { name: 'Acme SARL', startDate: '2026-09-01', endDate: '2027-06-30' },
        ...overrides,
    };
}

describe('GraphQL peda sessions', () => {
    it('creates a session and lists it', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const created = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { ${SESSION_FIELDS} } }`,
            { input: sessionInput(suffix) },
        );
        expect(created.errors).toBeUndefined();
        expect(created.data.createSession).toMatchObject({
            nom: `BTS MCO ${suffix} Groupe A`,
            filiere: 'Management Commercial',
            jourCours: 'Lundi',
            alternantCount: 0,
        });
        expect(created.data.createSession.dateDebut.slice(0, 10)).toBe('2026-09-01');
        expect(created.data.createSession.dateFin.slice(0, 10)).toBe('2027-06-30');

        const list = await gqlFetch(auth, `{ sessions { ${SESSION_FIELDS} } }`);
        expect(list.errors).toBeUndefined();
        expect(list.data.sessions.map((s: { id: string }) => s.id)).toContain(created.data.createSession.id);
    });

    it('rejects creation without required fields and with fin < debut', async () => {
        const auth = pedaAuth();
        const missing = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            { input: sessionInput(Date.now(), { nom: '  ' }) },
        );
        expect(missing.errors).toBeDefined();

        const inverted = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            { input: sessionInput(Date.now(), { dateDebut: '2027-06-30', dateFin: '2026-09-01' }) },
        );
        expect(inverted.errors).toBeDefined();
        expect(String(inverted.errors[0].message)).toMatch(/postérieure/);

        const badDay = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            { input: sessionInput(Date.now(), { jourCours: 'Funday' }) },
        );
        expect(badDay.errors).toBeDefined();
    });

    it('rejects duplicate session names', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const first = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            { input: sessionInput(suffix) },
        );
        expect(first.errors).toBeUndefined();
        const dup = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            { input: sessionInput(suffix) },
        );
        expect(dup.errors).toBeDefined();
        expect(String(dup.errors[0].message)).toMatch(/déjà avec ce nom/);
    });

    it('assigns and unassigns an alternant from the session side', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const session = (
            await gqlFetch(auth, `mutation($input: CreateSessionInput!) { createSession(input: $input) { id nom } }`, {
                input: sessionInput(`${suffix}a`),
            })
        ).data.createSession;
        const alternant = (
            await gqlFetch(
                auth,
                `mutation($input: CreateAlternantInput!) { createAlternant(input: $input) { id session sessionId } }`,
                { input: alternantInput(`${suffix}a`) },
            )
        ).data.createAlternant;
        expect(alternant.sessionId).toBeNull();

        const assigned = await gqlFetch(
            auth,
            `mutation($sessionId: ID!, $alternantId: ID!) {
                assignAlternantToSession(sessionId: $sessionId, alternantId: $alternantId) { id alternantCount }
            }`,
            { sessionId: session.id, alternantId: alternant.id },
        );
        expect(assigned.errors).toBeUndefined();
        expect(assigned.data.assignAlternantToSession.alternantCount).toBe(1);

        const members = await gqlFetch(
            auth,
            `query($sessionId: ID!) { sessionAlternants(sessionId: $sessionId) { id } }`,
            {
                sessionId: session.id,
            },
        );
        expect(members.data.sessionAlternants.map((m: { id: string }) => m.id)).toEqual([alternant.id]);

        // Le libellé de l'alternant suit le nom de la session.
        const fetched = await gqlFetch(auth, `query($id: ID!) { alternant(id: $id) { session sessionId } }`, {
            id: alternant.id,
        });
        expect(fetched.data.alternant).toMatchObject({ session: session.nom, sessionId: session.id });

        const removed = await gqlFetch(
            auth,
            `mutation($sessionId: ID!, $alternantId: ID!) {
                removeAlternantFromSession(sessionId: $sessionId, alternantId: $alternantId) { id alternantCount }
            }`,
            { sessionId: session.id, alternantId: alternant.id },
        );
        expect(removed.errors).toBeUndefined();
        expect(removed.data.removeAlternantFromSession.alternantCount).toBe(0);
    });

    it('creates an alternant directly inside a session via sessionId', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const session = (
            await gqlFetch(auth, `mutation($input: CreateSessionInput!) { createSession(input: $input) { id nom } }`, {
                input: sessionInput(`${suffix}b`),
            })
        ).data.createSession;
        const created = await gqlFetch(
            auth,
            `mutation($input: CreateAlternantInput!) { createAlternant(input: $input) { id session sessionId } }`,
            { input: { ...alternantInput(`${suffix}b`), sessionId: session.id } },
        );
        expect(created.errors).toBeUndefined();
        expect(created.data.createAlternant).toMatchObject({ session: session.nom, sessionId: session.id });
    });

    it('renames the session and resyncs member labels, then deletes it', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const session = (
            await gqlFetch(auth, `mutation($input: CreateSessionInput!) { createSession(input: $input) { id nom } }`, {
                input: sessionInput(`${suffix}c`),
            })
        ).data.createSession;
        const alternant = (
            await gqlFetch(auth, `mutation($input: CreateAlternantInput!) { createAlternant(input: $input) { id } }`, {
                input: { ...alternantInput(`${suffix}c`), sessionId: session.id },
            })
        ).data.createAlternant;

        const renamed = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: UpdateSessionInput!) { updateSession(id: $id, input: $input) { id nom } }`,
            { id: session.id, input: { nom: `BTS MCO ${suffix}c Groupe B` } },
        );
        expect(renamed.errors).toBeUndefined();
        const refetched = await gqlFetch(auth, `query($id: ID!) { alternant(id: $id) { session } }`, {
            id: alternant.id,
        });
        expect(refetched.data.alternant.session).toBe(`BTS MCO ${suffix}c Groupe B`);

        const deleted = await gqlFetch(auth, `mutation($id: ID!) { deleteSession(id: $id) }`, { id: session.id });
        expect(deleted.data.deleteSession).toBe(true);
        const gone = await gqlFetch(auth, `query($id: ID!) { session(id: $id) { id } }`, { id: session.id });
        expect(gone.data.session).toBeNull();
        // L'alternant survit, désassigné.
        const survivor = await gqlFetch(auth, `query($id: ID!) { alternant(id: $id) { id sessionId } }`, {
            id: alternant.id,
        });
        expect(survivor.data.alternant.sessionId).toBeNull();
    });

    it('forbids other employee roles without permission', async () => {
        const commercial = mintAuthCookies({ id: 3, email: 'com@test.local', role: 'COMMERCIAL', permission: 'GUEST' });
        const forbidden = await gqlFetch(commercial, `{ sessions { id } }`);
        expect(forbidden.errors).toBeDefined();
        expect(String(forbidden.errors[0].message)).toMatch(/Forbidden/);
    });
});
