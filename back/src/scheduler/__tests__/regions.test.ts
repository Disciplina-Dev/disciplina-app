import { describe, it, expect } from 'vitest';
import { runForAllRegions, getRegion } from '../../db/tenant';
import { VALID_REGIONS, type Region } from '../../types/tenant';

describe('runForAllRegions', () => {
    it('exécute fn une fois par tenant, avec la région posée dans l’ALS', async () => {
        const observed: Region[] = [];
        const results = await runForAllRegions(async () => {
            observed.push(getRegion());
            return getRegion();
        });
        expect(observed.sort()).toEqual([...VALID_REGIONS].sort());
        expect(results.sort()).toEqual([...VALID_REGIONS].sort());
    });

    it('propage les erreurs d’une région sans bloquer les autres', async () => {
        const started: string[] = [];
        await expect(
            runForAllRegions(async () => {
                started.push(getRegion());
                if (getRegion() === 'annemasse') throw new Error('boom');
            }),
        ).rejects.toThrow('boom');
        expect(started.sort()).toEqual([...VALID_REGIONS].sort());
    });
});