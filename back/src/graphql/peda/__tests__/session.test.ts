import { describe, it, expect, vi, afterEach } from 'vitest';
import { FilizService } from '../../../external/filiz/filiz.service';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { getModels } from '../../../db/mongo/tenant';
import { AlternantModel } from '../../../db/mongo/schemas/alternant.schema';

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

describe('GraphQL peda sessions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('lists Filiz classes as sessions, with their degree as filière', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const degreeId = `sess-degree-${suffix}`;
        const classId = `sess-class-${suffix}`;
        await getModels().FilizDegree.create({
            _id: degreeId,
            degree_type: 'TP',
            title: 'Management Commercial',
            prepared_title: 'MCO',
            synced_at: new Date(),
        });
        await getModels().FilizClass.create({
            _id: classId,
            degree_id: degreeId,
            name: `BTS MCO ${suffix} Groupe A`,
            start_date: '2026-09-01',
            end_date: '2027-06-30',
            apprenticeship_contract: true,
            professionalization_contract: false,
            synced_at: new Date(),
        });
        try {
            const list = await gqlFetch(auth, `{ sessions { ${SESSION_FIELDS} } }`);
            expect(list.errors).toBeUndefined();
            const found = list.data.sessions.find((x: { id: string }) => x.id === classId);
            expect(found).toMatchObject({
                nom: `BTS MCO ${suffix} Groupe A`,
                filiere: 'Management Commercial',
                jourCours: null,
                alternantCount: 0,
            });
            expect(found.dateDebut.slice(0, 10)).toBe('2026-09-01');
            expect(found.dateFin.slice(0, 10)).toBe('2027-06-30');
        } finally {
            await getModels().FilizClass.deleteOne({ _id: classId });
            await getModels().FilizDegree.deleteOne({ _id: degreeId });
        }
    });

    it('counts and lists the alternants whose Filiz folder belongs to the class', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const classId = `sess-class-members-${suffix}`;
        await getModels().FilizClass.create({
            _id: classId,
            degree_id: 'sess-degree',
            name: `Promo ${suffix}`,
            start_date: null,
            end_date: null,
            apprenticeship_contract: true,
            professionalization_contract: false,
            synced_at: new Date(),
        });
        const member = await AlternantModel.create({
            _id: `sess-alt-${suffix}`,
            first_name: 'Léa',
            last_name: `Martin-${suffix}`,
            session: '',
            session_id: null,
            filiz: {
                folder_id: `sess-folder-${suffix}`,
                class_id: classId,
                step: 3,
                start_step: 1,
                synced_at: new Date(),
            },
        });
        try {
            const res = await gqlFetch(
                auth,
                `query($id: ID!) { session(id: $id) { alternantCount } sessionAlternants(sessionId: $id) { id } }`,
                { id: classId },
            );
            expect(res.errors).toBeUndefined();
            expect(res.data.session.alternantCount).toBe(1);
            expect(res.data.sessionAlternants.map((m: { id: string }) => m.id)).toEqual([member._id]);
        } finally {
            await AlternantModel.deleteOne({ _id: member._id });
            await getModels().FilizClass.deleteOne({ _id: classId });
        }
    });

    it('treats the search term literally (regex metacharacters are escaped)', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const classId = `sess-class-search-${suffix}`;
        await getModels().FilizClass.create({
            _id: classId,
            degree_id: 'sess-degree',
            name: `BTS MCO ${suffix} Groupe A`,
            start_date: null,
            end_date: null,
            apprenticeship_contract: true,
            professionalization_contract: false,
            synced_at: new Date(),
        });
        try {
            const SEARCH = `query($s: String) { sessions(search: $s) { id } }`;
            for (const s of ['.', '.*', '(a+)+$', '[', 'x'.repeat(5000)]) {
                const started = Date.now();
                const res = await gqlFetch(auth, SEARCH, { s });
                expect(res.errors).toBeUndefined();
                expect(res.data.sessions.map((x: { id: string }) => x.id)).not.toContain(classId);
                expect(Date.now() - started).toBeLessThan(2000);
            }
            const hit = await gqlFetch(auth, SEARCH, { s: `MCO ${suffix}` });
            expect(hit.data.sessions.map((x: { id: string }) => x.id)).toContain(classId);
        } finally {
            await getModels().FilizClass.deleteOne({ _id: classId });
        }
    });

    it('forbids other employee roles without permission', async () => {
        const commercial = mintAuthCookies({ id: 3, email: 'com@test.local', role: 'COMMERCIAL', permission: 'GUEST' });
        const forbidden = await gqlFetch(commercial, `{ sessions { id } }`);
        expect(forbidden.errors).toBeDefined();
        expect(String(forbidden.errors[0].message)).toMatch(/Forbidden/);
    });

    describe('renameSession', () => {
        const RENAME = `mutation($id: ID!, $nom: String!) { renameSession(id: $id, nom: $nom) { id nom } }`;

        async function withClass(run: (classId: string) => Promise<void>) {
            const classId = `sess-rename-${Date.now()}`;
            await getModels().FilizClass.create({
                _id: classId,
                degree_id: 'sess-degree',
                name: 'Ancien nom',
                start_date: null,
                end_date: null,
                apprenticeship_contract: true,
                professionalization_contract: false,
                synced_at: new Date(),
            });
            try {
                await run(classId);
            } finally {
                await getModels().FilizClass.deleteOne({ _id: classId });
            }
        }

        it('GETs the class, PATCHes the full payload with the new name and updates the local mirror', async () => {
            await withClass(async (classId) => {
                const current = {
                    degreeId: 'sess-degree',
                    classId,
                    className: 'Ancien nom',
                    startDate: '09/01/2026',
                    endDate: '06/30/2027',
                    classStudyConfig: { degreeAmount: '10000' },
                };
                vi.spyOn(FilizService.prototype, 'getClass').mockResolvedValue(current as any);
                const patch = vi.spyOn(FilizService.prototype, 'updateClass').mockResolvedValue(classId);

                const res = await gqlFetch(pedaAuth(), RENAME, { id: classId, nom: '  Nouveau nom  ' });
                expect(res.errors).toBeUndefined();
                expect(res.data.renameSession).toEqual({ id: classId, nom: 'Nouveau nom' });

                const sent = patch.mock.calls[0][0];
                expect(sent).toMatchObject({ classId, className: 'Nouveau nom', startDate: '09/01/2026' });
                expect(sent).not.toHaveProperty('degreeId');
                expect((await getModels().FilizClass.findOne({ _id: classId }).lean())?.name).toBe('Nouveau nom');
            });
        });

        it('leaves the local class untouched when Filiz rejects the PATCH', async () => {
            await withClass(async (classId) => {
                vi.spyOn(FilizService.prototype, 'getClass').mockResolvedValue({
                    classId,
                    className: 'Ancien nom',
                } as any);
                vi.spyOn(FilizService.prototype, 'updateClass').mockResolvedValue(null);

                const res = await gqlFetch(pedaAuth(), RENAME, { id: classId, nom: 'Nouveau nom' });
                expect(res.errors).toBeDefined();
                expect((await getModels().FilizClass.findOne({ _id: classId }).lean())?.name).toBe('Ancien nom');
            });
        });

        it('rejects an empty name without calling Filiz', async () => {
            await withClass(async (classId) => {
                const get = vi.spyOn(FilizService.prototype, 'getClass');
                const res = await gqlFetch(pedaAuth(), RENAME, { id: classId, nom: '   ' });
                expect(res.errors).toBeDefined();
                expect(get).not.toHaveBeenCalled();
            });
        });

        it('forbids other employee roles', async () => {
            const commercial = mintAuthCookies({
                id: 3,
                email: 'com@test.local',
                role: 'COMMERCIAL',
                permission: 'GUEST',
            });
            const res = await gqlFetch(commercial, RENAME, { id: 'x', nom: 'y' });
            expect(String(res.errors[0].message)).toMatch(/Forbidden/);
        });
    });
});
