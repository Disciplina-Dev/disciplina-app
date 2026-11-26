import { describe, it, expect } from 'vitest';
import { signatureAssets } from '../docuseal.service';
import { syncWithRegion } from '../../../db/tenant';

const PDF_MAGIC = '%PDF';

describe('signatureAssets', () => {
    it('sert les PDF Réunion par défaut', () => {
        const mandat = syncWithRegion('reunion', () => signatureAssets.mandat());
        const catalogue = syncWithRegion('reunion', () => signatureAssets.catalogue());

        expect(mandat).not.toBeNull();
        expect(catalogue).not.toBeNull();
        expect(mandat!.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);
        expect(catalogue!.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);
    });

    it('sert les PDF Annemasse pour le tenant Annemasse', () => {
        const mandat = syncWithRegion('annemasse', () => signatureAssets.mandat());
        const catalogue = syncWithRegion('annemasse', () => signatureAssets.catalogue());

        expect(mandat).not.toBeNull();
        expect(catalogue).not.toBeNull();
        expect(mandat!.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);
        expect(catalogue!.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);

        // Le mandat Annemasse est plus gros que celui de Réunion et son catalogue
        // est un document distinct : si les fichiers n'étaient pas résolus par
        // tenant, les buffers seraient identiques.
        const reunionMandat = syncWithRegion('reunion', () => signatureAssets.mandat())!;
        const reunionCatalogue = syncWithRegion('reunion', () => signatureAssets.catalogue())!;
        expect(mandat!.equals(reunionMandat)).toBe(false);
        expect(catalogue!.equals(reunionCatalogue)).toBe(false);
    });
});
