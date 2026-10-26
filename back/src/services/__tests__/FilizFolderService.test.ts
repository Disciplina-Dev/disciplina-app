import { describe, it, expect } from 'vitest';
import {
    buildFilizFolderPayload,
    extractFilizEmployer,
    pickFilizStartStep,
    FilizEmployer,
} from '../FilizFolderService';

const completeCandidate: any = {
    identity: {
        full_name: 'Jean DUPONT',
        email: 'jean@test.local',
        phone: '+33612345678',
        date_of_birth: new Date('2000-05-02T00:00:00Z'),
        place_of_birth: 'Paris',
        department_of_birth: '75',
        born_in_france: true,
        nationality: 1,
        sex: 'GARCON',
        address: '1 rue des Fleurs',
        postal_code: '97400',
        city: 'Saint-Denis',
        country: 'France',
    },
};
const basicCandidate: any = {
    identity: { full_name: 'Jean DUPONT', email: 'jean@test.local', phone: '', date_of_birth: new Date('2000-05-02') },
};
const contact = { firstName: 'Marie', lastName: 'DURAND', mailAddress: 'marie@entreprise.fr' };
const manager = { firstName: 'Jane', lastName: 'Doe', mailAddress: 'jane@test.local' };

describe('extractFilizEmployer', () => {
    const needsAnalysis: any = {
        company_infos: { name: 'ENTREPRISE7', siret: '222 222 222 22207' },
        referents: {
            recruitment_referents: { name: 'Marie DURAND', email: 'marie@entreprise.fr' },
            legal_referents: { name: 'Paul MARTIN', email: 'paul@entreprise.fr' },
        },
    };
    const offer: any = {
        title: 'Vendeur',
        desired_tp: [{ description_missions: ['Accueil client', 'Caisse'] }, { description_missions: ['Caisse'] }],
    };

    it('reads the company, the recruitment contact and the mission', () => {
        expect(extractFilizEmployer(offer, needsAnalysis)).toEqual({
            siret: '22222222222207',
            legalName: 'ENTREPRISE7',
            contact,
            missionTitle: 'Vendeur',
            missionDescription: 'Accueil client\nCaisse',
        });
    });

    it('falls back to the legal referent when the recruitment contact has no email', () => {
        const na = {
            ...needsAnalysis,
            referents: { ...needsAnalysis.referents, recruitment_referents: { name: 'Marie DURAND' } },
        };
        expect(extractFilizEmployer(null, na).contact).toEqual({
            firstName: 'Paul',
            lastName: 'MARTIN',
            mailAddress: 'paul@entreprise.fr',
        });
    });

    it('ignores a malformed SIRET and a contact without a last name', () => {
        const na = {
            company_infos: { siret: '123' },
            referents: { recruitment_referents: { name: 'Marie', email: 'marie@entreprise.fr' } },
        } as any;
        const employer = extractFilizEmployer(null, na);
        expect(employer.siret).toBeUndefined();
        expect(employer.contact).toBeUndefined();
    });

    it('is empty without any contract', () => {
        expect(extractFilizEmployer(null, null)).toEqual({
            siret: undefined,
            legalName: undefined,
            contact: undefined,
            missionTitle: undefined,
            missionDescription: undefined,
        });
    });
});

describe('pickFilizStartStep', () => {
    it('starts at step 4 with a complete student, a contact and a SIRET', () => {
        expect(pickFilizStartStep(completeCandidate, { contact, siret: '22222222222207' })).toBe(4);
    });
    it('starts at step 3 without a SIRET', () => {
        expect(pickFilizStartStep(completeCandidate, { contact })).toBe(3);
    });
    it('starts at step 1 without a company contact', () => {
        expect(pickFilizStartStep(completeCandidate, { siret: '22222222222207' })).toBe(1);
        expect(pickFilizStartStep(completeCandidate, {})).toBe(1);
    });
    it('starts at step 1 when the student is incomplete', () => {
        expect(pickFilizStartStep(basicCandidate, { contact, siret: '22222222222207' })).toBe(1);
    });
});

describe('buildFilizFolderPayload', () => {
    const employer: FilizEmployer = {
        contact,
        siret: '22222222222207',
        legalName: 'ENTREPRISE7',
        missionTitle: 'Vendeur',
    };

    it('step 1 sends the bare student identity and no company', () => {
        const payload = buildFilizFolderPayload(completeCandidate, { contact }, 1, 'class-1', manager);
        expect(payload.studentInfos).toEqual({ firstName: 'Jean', lastName: 'DUPONT', mailAddress: 'jean@test.local' });
        expect(payload.companyInfos).toBeUndefined();
        expect(payload.config.folder).toMatchObject({ step: 1, classId: 'class-1', type: 'STUDY' });
        expect(payload.config.folder.contractType).toBeUndefined();
        expect(payload.contactCompanyInfos).toEqual(contact);
    });

    it('step 3 sends the full identity', () => {
        const payload = buildFilizFolderPayload(completeCandidate, { contact }, 3, 'class-1', manager);
        expect(payload.studentInfos).toMatchObject({ bornInFrance: true, nationality: 1, departmentOfBirth: '75' });
        expect(payload.companyInfos).toBeUndefined();
    });

    it('step 4 adds the company by SIRET and the contract type', () => {
        const payload = buildFilizFolderPayload(completeCandidate, employer, 4, 'class-1', manager);
        expect(payload.companyInfos).toEqual({
            siretNumber: '22222222222207',
            sirenNumber: '222222222',
            legalName: 'ENTREPRISE7',
        });
        expect(payload.config.folder).toMatchObject({
            step: 4,
            contractType: 'APPRENTICESHIP',
            missionTitle: 'Vendeur',
        });
    });
});
