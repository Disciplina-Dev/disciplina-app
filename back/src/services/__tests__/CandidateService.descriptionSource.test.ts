import { afterAll, describe, it, expect } from 'vitest';
import { CandidateService } from '../CandidateService';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';

// Le résumé (`identity.description`) est régénéré automatiquement à chaque mise à
// jour du dossier (CV, statut, avatar…) tant qu'il est de source `auto`. Dès qu'un
// RH le modifie, il passe en `manual` et n'est plus écrasé — sauf via les boutons
// dédiés (« Régénérer » envoie `description_source: 'auto'`, « Résumé IA » envoie
// `manual` avec le texte généré).
describe('CandidateService description_source', () => {
    const service = new CandidateService();
    const createdIds: string[] = [];

    async function seedCandidate(suffix: number, description?: string): Promise<string> {
        const id = `cand-desc-${suffix}`;
        createdIds.push(id);
        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.CC],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Candidat Description ${suffix}`,
                email: `cand-desc-${suffix}@test.local`,
                phone: '0692000099',
                city: 'Saint-Denis',
                ...(description !== undefined ? { description } : {}),
            } as any,
        } as any);
        return id;
    }

    afterAll(async () => {
        if (createdIds.length) await CandidateModel.deleteMany({ _id: { $in: createdIds } });
    });

    it('génère un résumé automatique à la création et le marque `auto`', async () => {
        const id = await seedCandidate(Date.now());

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toContain('Saint-Denis');
        expect(stored?.identity.description_source).toBe('auto');
    });

    it('protège une description fournie à la création (`manual`)', async () => {
        const id = await seedCandidate(Date.now() + 1, 'Texte saisi par le RH.');

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toBe('Texte saisi par le RH.');
        expect(stored?.identity.description_source).toBe('manual');
    });

    it("n'écrase pas une description manuelle lors d'une mise à jour partielle (ajout de CV)", async () => {
        const id = await seedCandidate(Date.now() + 2, 'Texte saisi par le RH.');

        await service.update(id, { cv_link: 'https://drive.test/cv.pdf' });

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.cv_link).toBe('https://drive.test/cv.pdf');
        expect(stored?.identity.description).toBe('Texte saisi par le RH.');
        expect(stored?.identity.description_source).toBe('manual');
    });

    it("régénère un résumé automatique lors d'une mise à jour partielle", async () => {
        const id = await seedCandidate(Date.now() + 3);

        await service.update(id, { identity: { city: 'Saint-Paul' } } as any);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toContain('Saint-Paul');
        expect(stored?.identity.description_source).toBe('auto');
    });

    it('marque `manual` une description modifiée par un RH', async () => {
        const id = await seedCandidate(Date.now() + 4);

        await service.update(id, { identity: { description: 'Résumé retravaillé par le RH.' } } as any);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toBe('Résumé retravaillé par le RH.');
        expect(stored?.identity.description_source).toBe('manual');
    });

    it('conserve la source `auto` quand la description renvoyée est inchangée', async () => {
        const id = await seedCandidate(Date.now() + 5);
        const before = await CandidateModel.findById(id).lean();

        // Cas d'un enregistrement complet de la fiche qui renvoie le résumé existant.
        await service.update(id, {
            identity: { description: before?.identity.description },
        } as any);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description_source).toBe('auto');
    });

    it("accepte le bouton « Régénérer » sur une description manuelle (`description_source: 'auto'`)", async () => {
        const id = await seedCandidate(Date.now() + 6, 'Texte saisi par le RH.');

        await service.update(id, {
            identity: {
                description: 'Résumé régénéré depuis la fiche.',
                description_source: 'auto',
            },
        } as any);
        await service.update(id, { identity: { city: 'Saint-Pierre' } } as any);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toContain('Saint-Pierre');
        expect(stored?.identity.description_source).toBe('auto');
    });

    it('reprend la génération automatique quand le champ est vidé explicitement', async () => {
        const id = await seedCandidate(Date.now() + 7, 'Texte saisi par le RH.');

        await service.update(id, { identity: { description: '' } } as any);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.identity.description).toContain('Saint-Denis');
        expect(stored?.identity.description_source).toBe('auto');
    });
});
