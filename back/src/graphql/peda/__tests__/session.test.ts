import { describe, it, expect, vi, afterEach } from 'vitest';
import { FilizService } from '../../../external/filiz/filiz.service';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { getModels } from '../../../db/mongo/tenant';
import { resetFilizQuotas } from '../filizRateLimit';
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
        resetFilizQuotas();
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

    describe('createSession', () => {
        const CREATE = `mutation($input: CreateSessionInput!) { createSession(input: $input) { id nom filiere dateDebut dateFin } }`;
        const degreeId = 'sess-create-degree';
        const classId = 'sess-create-class';
        const input = {
            degreeId,
            nom: '  BTS MCO 2026  ',
            dateDebut: '2026-09-01',
            dateFin: '2027-06-30',
            subjectValidation: true,
        };

        async function withDegree(run: () => Promise<void>) {
            await getModels().FilizDegree.create({
                _id: degreeId,
                degree_type: 'BTS',
                title: 'BTS MCO',
                prepared_title: 'BTS MCO',
                synced_at: new Date(),
            });
            try {
                await run();
            } finally {
                await getModels().FilizDegree.deleteOne({ _id: degreeId });
                await getModels().FilizClass.deleteOne({ _id: classId });
            }
        }

        it('POSTs the Filiz payload (MM/DD/YYYY, optional blocks omitted) and mirrors the class', async () => {
            await withDegree(async () => {
                const post = vi.spyOn(FilizService.prototype, 'createClass').mockResolvedValue(classId);
                vi.spyOn(FilizService.prototype, 'getClass').mockResolvedValue({
                    degreeId,
                    classId,
                    className: 'BTS MCO 2026',
                    startDate: '09/01/2026',
                    endDate: '06/30/2027',
                } as any);

                const res = await gqlFetch(pedaAuth(), CREATE, { input });
                expect(res.errors).toBeUndefined();
                expect(res.data.createSession).toMatchObject({ id: classId, nom: 'BTS MCO 2026', filiere: 'BTS MCO' });

                expect(post.mock.calls[0][0]).toEqual({
                    degreeId,
                    className: 'BTS MCO 2026',
                    startDate: '09/01/2026',
                    endDate: '06/30/2027',
                    classStudyConfig: { subjectValidation: true },
                });
                expect((await getModels().FilizClass.findOne({ _id: classId }).lean())?.degree_id).toBe(degreeId);
            });
        });

        it('sends overrides only when filled', async () => {
            await withDegree(async () => {
                const post = vi.spyOn(FilizService.prototype, 'createClass').mockResolvedValue(classId);
                vi.spyOn(FilizService.prototype, 'getClass').mockResolvedValue({
                    degreeId,
                    classId,
                    className: 'X',
                } as any);

                await gqlFetch(pedaAuth(), CREATE, {
                    input: {
                        ...input,
                        generalEducationDuration: '300',
                        headTeacher: { firstName: 'Jo', lastName: 'Doe', mailAddress: 'jo@doe.fr' },
                        realizationAddress: { city: 'Paris', street: '  ', postcode: '75012' },
                    },
                });
                expect(post.mock.calls[0][0]).toMatchObject({
                    classStudyConfig: {
                        subjectValidation: true,
                        professionalizationContractConfig: { generalEducationDuration: '300' },
                    },
                    headTeacher: { firstName: 'Jo', lastName: 'Doe', mailAddress: 'jo@doe.fr' },
                    realizationAddress: { city: 'Paris', postcode: '75012' },
                });
                expect(post.mock.calls[0][0]).not.toHaveProperty('referentTeacher');
                expect((post.mock.calls[0][0] as any).realizationAddress).not.toHaveProperty('street');
            });
        });

        it('errors and mirrors nothing when Filiz refuses the creation', async () => {
            await withDegree(async () => {
                vi.spyOn(FilizService.prototype, 'createClass').mockResolvedValue(null);
                const res = await gqlFetch(pedaAuth(), CREATE, { input });
                expect(res.errors).toBeDefined();
                expect(await getModels().FilizClass.findOne({ _id: classId }).lean()).toBeNull();
            });
        });

        it.each([
            ['empty name', { nom: '  ' }],
            ['end before start', { dateFin: '2026-08-01' }],
            ['unknown degree', { degreeId: 'nope' }],
        ])('rejects %s without calling Filiz', async (_label, patch) => {
            await withDegree(async () => {
                const post = vi.spyOn(FilizService.prototype, 'createClass');
                const res = await gqlFetch(pedaAuth(), CREATE, { input: { ...input, ...patch } });
                expect(res.errors).toBeDefined();
                expect(post).not.toHaveBeenCalled();
            });
        });

        it('forbids other employee roles', async () => {
            const commercial = mintAuthCookies({
                id: 3,
                email: 'com@test.local',
                role: 'COMMERCIAL',
                permission: 'GUEST',
            });
            const res = await gqlFetch(commercial, CREATE, { input });
            expect(String(res.errors[0].message)).toMatch(/Forbidden/);
        });
    });

    it('lists degrees for the creation form', async () => {
        await getModels().FilizDegree.create({
            _id: 'sess-list-degree',
            degree_type: 'BTS',
            title: 'Formation liste',
            prepared_title: 'x',
            synced_at: new Date(),
        });
        try {
            const res = await gqlFetch(pedaAuth(), `{ sessionDegrees { id title } }`);
            expect(res.errors).toBeUndefined();
            expect(res.data.sessionDegrees).toContainEqual({ id: 'sess-list-degree', title: 'Formation liste' });
        } finally {
            await getModels().FilizDegree.deleteOne({ _id: 'sess-list-degree' });
        }
    });

    describe('syncSessionReference', () => {
        const SYNC = `mutation { syncSessionReference { degrees classes } }`;
        const degreeId = 'sess-sync-degree';
        const classId = 'sess-sync-class';

        afterEach(async () => {
            await getModels().FilizDegree.deleteOne({ _id: degreeId });
            await getModels().FilizClass.deleteOne({ _id: classId });
        });

        it('upserts degrees and classes from Filiz and exposes them', async () => {
            vi.spyOn(FilizService.prototype, 'getDegreesInfos').mockResolvedValue([
                { degreeId, degreeType: 'BTS', exactDegreeTitle: 'Formation sync', preparedTitleName: 'x' } as any,
            ]);
            vi.spyOn(FilizService.prototype, 'getClassInfos').mockResolvedValue([
                { degreeId, classId, className: 'Promo sync' } as any,
            ]);

            const res = await gqlFetch(pedaAuth(), SYNC);
            expect(res.errors).toBeUndefined();
            expect(res.data.syncSessionReference).toEqual({ degrees: 1, classes: 1 });

            const degrees = await gqlFetch(pedaAuth(), `{ sessionDegrees { id title } }`);
            expect(degrees.data.sessionDegrees).toContainEqual({ id: degreeId, title: 'Formation sync' });
            expect((await getModels().FilizClass.findOne({ _id: classId }).lean())?.name).toBe('Promo sync');
        });

        it('rate limits a second sync inside the window without calling Filiz again', async () => {
            const get = vi.spyOn(FilizService.prototype, 'getDegreesInfos').mockResolvedValue([]);
            await gqlFetch(pedaAuth(), SYNC);
            const second = await gqlFetch(pedaAuth(), SYNC);
            expect(String(second.errors[0].message)).toMatch(/Trop de requêtes vers Filiz/);
            expect(get).toHaveBeenCalledTimes(1);
        });

        it('errors when Filiz is unreachable', async () => {
            vi.spyOn(FilizService.prototype, 'getDegreesInfos').mockResolvedValue(null);
            const res = await gqlFetch(pedaAuth(), SYNC);
            expect(res.errors).toBeDefined();
        });

        it('forbids other employee roles', async () => {
            const commercial = mintAuthCookies({
                id: 3,
                email: 'com@test.local',
                role: 'COMMERCIAL',
                permission: 'GUEST',
            });
            const res = await gqlFetch(commercial, SYNC);
            expect(String(res.errors[0].message)).toMatch(/Forbidden/);
        });
    });
});
