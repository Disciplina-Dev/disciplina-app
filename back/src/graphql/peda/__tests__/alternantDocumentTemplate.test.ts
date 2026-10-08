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

const CREATE_ALTERNANT = `
    mutation($input: CreateAlternantInput!) {
        createAlternant(input: $input) { id }
    }
`;

// 09-01 +15j = 09-16 (numéro 1, j15), +70j = 11-10 (numéro 2, j10w), +4 mois =
// 2027-03-10 (numéro 3, periodique) — même planning que alternant.test.ts.
function alternantInput(suffix: string | number, overrides: Record<string, unknown> = {}) {
    return {
        firstName: `Doc-${suffix}`,
        lastName: `Test-${suffix}`,
        session: `DOC-${suffix}`,
        company: { name: 'Acme SARL', startDate: '2026-09-01', endDate: '2027-06-30' },
        ...overrides,
    };
}

const DOCUMENT_FIELDS = `sequenceId header { alternantFullName session mentorName } maitreApprentissage alternant formateur signatureMaitreApprentissage signatureAlternant signatureFormateur isSnapshotted template { maitreApprentissage alternant formateur }`;

const PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function sequencesOf(auth: { cookieHeader: string; csrfHeader: string }, alternantId: string) {
    const res = await gqlFetch(
        auth,
        `query($alternantId: ID!) { alternantSequences(alternantId: $alternantId) { id numero type } }`,
        { alternantId },
    );
    return res.data.alternantSequences as { id: string; numero: number; type: string }[];
}

describe('GraphQL peda alternant document templates (#888)', () => {
    it('seeds exactly one system template per j15/j10w type at boot', async () => {
        const auth = pedaAuth();
        const j15 = await gqlFetch(auth, `query { alternantDocumentTemplates(type: j15) { id type label } }`);
        const j10w = await gqlFetch(auth, `query { alternantDocumentTemplates(type: j10w) { id type label } }`);
        expect(j15.data.alternantDocumentTemplates).toHaveLength(1);
        expect(j15.data.alternantDocumentTemplates[0].type).toBe('j15');
        expect(j10w.data.alternantDocumentTemplates).toHaveLength(1);
        expect(j10w.data.alternantDocumentTemplates[0].type).toBe('j10w');
    });

    it('resolves the j15 system template as a starting point, then snapshots it on save without being affected by later template edits', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();

        const j15Template = (await gqlFetch(auth, `query { alternantDocumentTemplates(type: j15) { id } }`)).data
            .alternantDocumentTemplates[0];
        const updateTpl = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: AlternantDocumentTemplateInput!) {
                updateAlternantDocumentTemplate(id: $id, input: $input) { id maitreApprentissage }
            }`,
            {
                id: j15Template.id,
                input: {
                    label: 'Prise de contact (J+15)',
                    maitreApprentissage: '<p>Modèle MA J15</p>',
                    alternant: '<p>Modèle Alternant J15</p>',
                    formateur: '<p>Modèle Formateur J15</p>',
                },
            },
        );
        expect(updateTpl.errors).toBeUndefined();

        const created = (await gqlFetch(auth, CREATE_ALTERNANT, { input: alternantInput(suffix) })).data
            .createAlternant;
        const seqs = await sequencesOf(auth, created.id);
        const j15Seq = seqs.find((s) => s.numero === 1);
        expect(j15Seq?.type).toBe('j15');

        const before = await gqlFetch(
            auth,
            `query($id: ID!) { alternantSequenceDocument(sequenceId: $id) { ${DOCUMENT_FIELDS} } }`,
            { id: j15Seq!.id },
        );
        expect(before.errors).toBeUndefined();
        expect(before.data.alternantSequenceDocument).toMatchObject({
            maitreApprentissage: '<p>Modèle MA J15</p>',
            isSnapshotted: false,
        });
        expect(before.data.alternantSequenceDocument.header.alternantFullName).toBe(`Doc-${suffix} Test-${suffix}`);

        const saved = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: SaveAlternantSequenceDocumentInput!) {
                saveAlternantSequenceDocument(sequenceId: $id, input: $input) { ${DOCUMENT_FIELDS} }
            }`,
            {
                id: j15Seq!.id,
                input: {
                    maitreApprentissage: '<p>Rempli par le MA</p>',
                    alternant: '<p>Rempli par l’alternant</p>',
                    formateur: '<p>Rempli par le formateur</p>',
                },
            },
        );
        expect(saved.data.saveAlternantSequenceDocument).toMatchObject({
            maitreApprentissage: '<p>Rempli par le MA</p>',
            isSnapshotted: true,
        });

        // Le modèle système est modifié après coup : la SA déjà remplie ne doit pas changer.
        await gqlFetch(
            auth,
            `mutation($id: ID!, $input: AlternantDocumentTemplateInput!) {
                updateAlternantDocumentTemplate(id: $id, input: $input) { id }
            }`,
            {
                id: j15Template.id,
                input: {
                    label: 'Prise de contact (J+15)',
                    maitreApprentissage: '<p>Nouveau modèle, ne doit pas apparaître</p>',
                    alternant: '',
                    formateur: '',
                },
            },
        );
        const after = await gqlFetch(
            auth,
            `query($id: ID!) { alternantSequenceDocument(sequenceId: $id) { maitreApprentissage isSnapshotted } }`,
            { id: j15Seq!.id },
        );
        expect(after.data.alternantSequenceDocument).toMatchObject({
            maitreApprentissage: '<p>Rempli par le MA</p>',
            isSnapshotted: true,
        });
    });

    it('sanitizes saved document HTML (strips disallowed tags)', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const created = (await gqlFetch(auth, CREATE_ALTERNANT, { input: alternantInput(suffix) })).data
            .createAlternant;
        const seqs = await sequencesOf(auth, created.id);
        const seq = seqs.find((s) => s.numero === 1)!;

        const res = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: SaveAlternantSequenceDocumentInput!) {
                saveAlternantSequenceDocument(sequenceId: $id, input: $input) { maitreApprentissage }
            }`,
            {
                id: seq.id,
                input: {
                    maitreApprentissage: '<script>alert(1)</script><p>ok</p>',
                    alternant: '<p>ok</p>',
                    formateur: '<p>ok</p>',
                },
            },
        );
        expect(res.data.saveAlternantSequenceDocument.maitreApprentissage).not.toContain('<script>');
        expect(res.data.saveAlternantSequenceDocument.maitreApprentissage).toContain('<p>ok</p>');
    });

    it('resolves a periodique sequence using the template chosen on its Session', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();

        const template = (
            await gqlFetch(
                auth,
                `mutation($input: AlternantDocumentTemplateInput!) {
                    createAlternantDocumentTemplate(input: $input) { id type }
                }`,
                {
                    input: {
                        label: `TP TEST ${suffix}`,
                        maitreApprentissage: '<p>Modèle périodique MA</p>',
                        alternant: '<p>Modèle périodique Alternant</p>',
                        formateur: '<p>Modèle périodique Formateur</p>',
                    },
                },
            )
        ).data.createAlternantDocumentTemplate;
        expect(template.type).toBe('periodique');

        const session = (
            await gqlFetch(
                auth,
                `mutation($input: CreateSessionInput!) { createSession(input: $input) { id documentTemplateId } }`,
                {
                    input: {
                        nom: `Session Doc ${suffix}`,
                        dateDebut: '2026-09-01',
                        dateFin: '2027-06-30',
                        documentTemplateId: template.id,
                    },
                },
            )
        ).data.createSession;
        expect(session.documentTemplateId).toBe(template.id);

        const created = (
            await gqlFetch(auth, CREATE_ALTERNANT, { input: alternantInput(suffix, { sessionId: session.id }) })
        ).data.createAlternant;
        const seqs = await sequencesOf(auth, created.id);
        const periodique = seqs.find((s) => s.numero === 3);
        expect(periodique?.type).toBe('periodique');

        const doc = await gqlFetch(
            auth,
            `query($id: ID!) { alternantSequenceDocument(sequenceId: $id) { maitreApprentissage isSnapshotted } }`,
            { id: periodique!.id },
        );
        expect(doc.data.alternantSequenceDocument).toMatchObject({
            maitreApprentissage: '<p>Modèle périodique MA</p>',
            isSnapshotted: false,
        });
    });

    it('rejects a Session pointing documentTemplateId at a system (j15/j10w) template', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const j15Template = (await gqlFetch(auth, `query { alternantDocumentTemplates(type: j15) { id } }`)).data
            .alternantDocumentTemplates[0];

        const res = await gqlFetch(
            auth,
            `mutation($input: CreateSessionInput!) { createSession(input: $input) { id } }`,
            {
                input: {
                    nom: `Session Invalide ${suffix}`,
                    dateDebut: '2026-09-01',
                    dateFin: '2027-06-30',
                    documentTemplateId: j15Template.id,
                },
            },
        );
        expect(res.errors).toBeDefined();
        expect(String(res.errors[0].message)).toMatch(/Modèle de document invalide/);
    });

    it('rejects deleting a system template but allows deleting a périodique one', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const j15Template = (await gqlFetch(auth, `query { alternantDocumentTemplates(type: j15) { id } }`)).data
            .alternantDocumentTemplates[0];
        const forbidden = await gqlFetch(auth, `mutation($id: ID!) { deleteAlternantDocumentTemplate(id: $id) }`, {
            id: j15Template.id,
        });
        expect(forbidden.errors).toBeDefined();

        const created = (
            await gqlFetch(
                auth,
                `mutation($input: AlternantDocumentTemplateInput!) {
                    createAlternantDocumentTemplate(input: $input) { id }
                }`,
                {
                    input: {
                        label: `À supprimer ${suffix}`,
                        maitreApprentissage: '',
                        alternant: '',
                        formateur: '',
                    },
                },
            )
        ).data.createAlternantDocumentTemplate;
        const allowed = await gqlFetch(auth, `mutation($id: ID!) { deleteAlternantDocumentTemplate(id: $id) }`, {
            id: created.id,
        });
        expect(allowed.errors).toBeUndefined();
        expect(allowed.data.deleteAlternantDocumentTemplate).toBe(true);
    });

    it('saves a signature per part (informal PNG) alongside the text, and rejects a non-image value', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();
        const created = (await gqlFetch(auth, CREATE_ALTERNANT, { input: alternantInput(suffix) })).data
            .createAlternant;
        const seqs = await sequencesOf(auth, created.id);
        const seq = seqs.find((s) => s.numero === 1)!;

        const saved = await gqlFetch(
            auth,
            `mutation($id: ID!, $input: SaveAlternantSequenceDocumentInput!) {
                saveAlternantSequenceDocument(sequenceId: $id, input: $input) { ${DOCUMENT_FIELDS} }
            }`,
            {
                id: seq.id,
                input: {
                    maitreApprentissage: '<p>ok</p>',
                    alternant: '<p>ok</p>',
                    formateur: '<p>ok</p>',
                    signatureMaitreApprentissage: PNG_DATA_URL,
                    // Pas une image : doit être silencieusement ignorée (stockée `null`), pas d'erreur 500.
                    signatureAlternant: 'not-an-image',
                },
            },
        );
        expect(saved.errors).toBeUndefined();
        expect(saved.data.saveAlternantSequenceDocument.signatureMaitreApprentissage).toBe(PNG_DATA_URL);
        expect(saved.data.saveAlternantSequenceDocument.signatureAlternant).toBeNull();
        expect(saved.data.saveAlternantSequenceDocument.signatureFormateur).toBeNull();
    });

    it('still resolves the applicable template after a snapshot is saved (for "Réinitialiser au modèle vierge")', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();

        const j15Template = (await gqlFetch(auth, `query { alternantDocumentTemplates(type: j15) { id } }`)).data
            .alternantDocumentTemplates[0];
        await gqlFetch(
            auth,
            `mutation($id: ID!, $input: AlternantDocumentTemplateInput!) {
                updateAlternantDocumentTemplate(id: $id, input: $input) { id }
            }`,
            {
                id: j15Template.id,
                input: {
                    label: 'Prise de contact (J+15)',
                    maitreApprentissage: '<p>Modèle vierge MA</p>',
                    alternant: '',
                    formateur: '',
                },
            },
        );

        const created = (await gqlFetch(auth, CREATE_ALTERNANT, { input: alternantInput(suffix) })).data
            .createAlternant;
        const seqs = await sequencesOf(auth, created.id);
        const seq = seqs.find((s) => s.numero === 1)!;

        await gqlFetch(
            auth,
            `mutation($id: ID!, $input: SaveAlternantSequenceDocumentInput!) {
                saveAlternantSequenceDocument(sequenceId: $id, input: $input) { isSnapshotted }
            }`,
            { id: seq.id, input: { maitreApprentissage: '<p>Rempli</p>', alternant: '', formateur: '' } },
        );

        const after = await gqlFetch(
            auth,
            `query($id: ID!) { alternantSequenceDocument(sequenceId: $id) { ${DOCUMENT_FIELDS} } }`,
            { id: seq.id },
        );
        expect(after.data.alternantSequenceDocument.isSnapshotted).toBe(true);
        expect(after.data.alternantSequenceDocument.maitreApprentissage).toBe('<p>Rempli</p>');
        // Le modèle reste exposé à côté du snapshot, pour "Réinitialiser au modèle vierge".
        expect(after.data.alternantSequenceDocument.template.maitreApprentissage).toBe('<p>Modèle vierge MA</p>');
    });
});
