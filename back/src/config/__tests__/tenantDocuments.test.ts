import { describe, it, expect } from 'vitest';
import { TENANT_DOCUMENTS, tenantDocuments } from '../tenantDocuments';
import { syncWithRegion } from '../../db/tenant';
import { VALID_REGIONS } from '../../types/tenant';

describe('TENANT_DOCUMENTS', () => {
    it('couvre toutes les régions avec une identité légale et au moins un contact', () => {
        for (const region of VALID_REGIONS) {
            const documents = TENANT_DOCUMENTS[region];
            expect(documents.legal.companyName).toBeTruthy();
            expect(documents.legal.address).toBeTruthy();
            expect(documents.legal.siret).toBeTruthy();
            expect(documents.legal.activityDeclaration).toBeTruthy();
            expect(documents.legal.updatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
            expect(documents.contacts.length).toBeGreaterThan(0);
            expect(documents.signatureAssets.mandatFile).toMatch(/\.pdf$/);
            expect(documents.signatureAssets.catalogueFile).toMatch(/\.pdf$/);
            expect(documents.signatureAssets.catalogueName).toBeTruthy();
        }
    });

    it("ne fait pas fuiter l'identité Réunion sur les documents Annemasse", () => {
        const annemasse = TENANT_DOCUMENTS.annemasse;
        const serialized = JSON.stringify({
            legal: annemasse.legal,
            contacts: annemasse.contacts,
        });
        expect(serialized).not.toContain('97438');
        expect(serialized).not.toContain('97828986600011');
        expect(serialized).not.toContain('04973484197');
        expect(serialized).not.toContain('@disciplina.re');
        expect(annemasse.legal.address).toContain('74100');
        expect(annemasse.legal.siret).toBe('13037296400010');
    });

    it('utilise des pièces jointes distinctes par tenant', () => {
        expect(TENANT_DOCUMENTS.annemasse.signatureAssets.mandatFile).not.toBe(
            TENANT_DOCUMENTS.reunion.signatureAssets.mandatFile,
        );
        expect(TENANT_DOCUMENTS.annemasse.signatureAssets.catalogueFile).not.toBe(
            TENANT_DOCUMENTS.reunion.signatureAssets.catalogueFile,
        );
        expect(TENANT_DOCUMENTS.annemasse.signatureAssets.catalogueName).not.toBe(
            TENANT_DOCUMENTS.reunion.signatureAssets.catalogueName,
        );
    });
});

describe('tenantDocuments', () => {
    it("lit la région courante de l'ALS", () => {
        expect(syncWithRegion('reunion', () => tenantDocuments().legal.companyName)).toBe('DISCIPLINA');
        expect(syncWithRegion('annemasse', () => tenantDocuments().legal.companyName)).toBe('DISCIPLINA ANNEMASSE');
    });
});
