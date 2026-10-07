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

const CREATE = `
    mutation($input: CreateAlternantInput!) {
        createAlternant(input: $input) {
            id fullName session
            company { name }
        }
    }
`;

function createInput(suffix: string | number) {
    return {
        firstName: `Rupt-${suffix}`,
        lastName: `Test-${suffix}`,
        session: `SIO-${suffix}`,
        email: `rupt-${suffix}@test.local`,
        company: { name: 'Acme SARL', startDate: '2026-09-01', endDate: '2027-06-30' },
    };
}

const MOTIF_45_JOURS =
    "Rupture pendant les 45 premiers jours en emploi, consécutifs ou non, de l'apprenti, par ce dernier ou l'employeur (art. L. 6222-18)";
const MOTIF_COMMUN_ACCORD =
    "Rupture d'un commun accord entre l'apprenti et l'employeur — aucune faute ne peut motiver un tel accord (art. L. 6222-18)";

const DECLARE = `
    mutation($input: DeclareRuptureInput!) {
        declareRupture(input: $input) {
            id alternantId fullName session dateRupture entreprise motif detail poursuitFormation
        }
    }
`;

describe('GraphQL peda ruptures', () => {
    it('declares a rupture with auto-filled entreprise and lists it in the monthly report', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const alternant = (await gqlFetch(auth, CREATE, { input: createInput(suffix) })).data.createAlternant;

        const declared = await gqlFetch(auth, DECLARE, {
            input: {
                alternantId: alternant.id,
                dateRupture: '2026-10-07',
                motif: MOTIF_45_JOURS,
                detail: 'Période d’essai non concluante',
                poursuitFormation: true,
            },
        });
        expect(declared.errors).toBeUndefined();
        const rupture = declared.data.declareRupture;
        expect(rupture.alternantId).toBe(alternant.id);
        expect(rupture.dateRupture.slice(0, 10)).toBe('2026-10-07');
        expect(rupture.entreprise).toBe('Acme SARL');
        expect(rupture.motif).toBe(MOTIF_45_JOURS);
        expect(rupture.poursuitFormation).toBe(true);

        const report = await gqlFetch(
            auth,
            `query($year: Int!, $month: Int!) {
                ruptures(year: $year, month: $month) {
                    id fullName session dateRupture entreprise motif detail poursuitFormation
                }
            }`,
            { year: 2026, month: 10 },
        );
        expect(report.errors).toBeUndefined();
        const found = report.data.ruptures.find((r: { id: string }) => r.id === rupture.id);
        expect(found).toBeDefined();
        expect(found.fullName).toBe(alternant.fullName);

        const otherMonth = await gqlFetch(auth, `query { ruptures(year: 2026, month: 9) { id } }`);
        expect(otherMonth.errors).toBeUndefined();
        expect(otherMonth.data.ruptures.map((r: { id: string }) => r.id)).not.toContain(rupture.id);
    });

    it('rejects declaration without date or motif, or with an unknown motif', async () => {
        const auth = pedaAuth();
        const alternant = (await gqlFetch(auth, CREATE, { input: createInput(`${Date.now()}b`) })).data.createAlternant;

        const noMotif = await gqlFetch(auth, DECLARE, {
            input: { alternantId: alternant.id, dateRupture: '2026-10-07', motif: '  ', poursuitFormation: false },
        });
        expect(noMotif.errors).toBeDefined();

        const badMotif = await gqlFetch(auth, DECLARE, {
            input: {
                alternantId: alternant.id,
                dateRupture: '2026-10-07',
                motif: 'Motif inventé',
                poursuitFormation: false,
            },
        });
        expect(badMotif.errors).toBeDefined();

        const badDate = await gqlFetch(auth, DECLARE, {
            input: { alternantId: alternant.id, dateRupture: 'pas-une-date', motif: MOTIF_COMMUN_ACCORD, poursuitFormation: false },
        });
        expect(badDate.errors).toBeDefined();

        const unknownAlternant = await gqlFetch(auth, DECLARE, {
            input: {
                alternantId: '00000000-0000-0000-0000-000000000000',
                dateRupture: '2026-10-07',
                motif: MOTIF_COMMUN_ACCORD,
                poursuitFormation: false,
            },
        });
        expect(unknownAlternant.errors).toBeDefined();
    });

    it('returns alternant ruptures and supports update + delete', async () => {
        const auth = pedaAuth();
        const alternant = (await gqlFetch(auth, CREATE, { input: createInput(`${Date.now()}c`) })).data.createAlternant;

        const created = (
            await gqlFetch(auth, DECLARE, {
                input: {
                    alternantId: alternant.id,
                    dateRupture: '2026-11-05',
                    entreprise: 'Autre SARL',
                    motif: MOTIF_COMMUN_ACCORD,
                    poursuitFormation: false,
                },
            })
        ).data.declareRupture;
        expect(created.entreprise).toBe('Autre SARL');
        expect(created.poursuitFormation).toBe(false);

        const byAlternant = await gqlFetch(
            auth,
            `query($alternantId: ID!) { alternantRuptures(alternantId: $alternantId) { id motif } }`,
            { alternantId: alternant.id },
        );
        expect(byAlternant.errors).toBeUndefined();
        expect(byAlternant.data.alternantRuptures.map((r: { id: string }) => r.id)).toContain(created.id);

        const updated = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: UpdateRuptureInput!) {
                updateRupture(id: $id, input: $input) { id poursuitFormation detail }
            }`,
            { id: created.id, input: { poursuitFormation: true, detail: 'Reprise en formation initiale' } },
        );
        expect(updated.errors).toBeUndefined();
        expect(updated.data.updateRupture.poursuitFormation).toBe(true);

        const deleted = await gqlFetch(auth, `mutation($id: ID!) { deleteRupture(id: $id) }`, { id: created.id });
        expect(deleted.errors).toBeUndefined();
        expect(deleted.data.deleteRupture).toBe(true);

        const after = await gqlFetch(
            auth,
            `query($alternantId: ID!) { alternantRuptures(alternantId: $alternantId) { id } }`,
            { alternantId: alternant.id },
        );
        expect(after.data.alternantRuptures.map((r: { id: string }) => r.id)).not.toContain(created.id);
    });

    it('rejects invalid month filters', async () => {
        const auth = pedaAuth();
        const res = await gqlFetch(auth, `query { ruptures(year: 2026, month: 13) { id } }`);
        expect(res.errors).toBeDefined();
    });
});
