import { describe, expect, it } from 'vitest';
import { maskCount, maskPartition } from '../pedaExposure';

describe('masquage k-anonymat péda', () => {
    it('masque 1 à 4, publie 0 et ≥ 5', () => {
        expect([0, 1, 4, 5, 12].map(maskCount)).toEqual([0, '<5', '<5', 5, 12]);
    });

    it('cas binaire : une cellule masquée masque aussi l’autre', () => {
        expect(maskPartition({ yes: 7, no: 3 })).toEqual({ yes: '<5', no: '<5' });
    });

    it('masquage secondaire : la plus petite cellule visible suit', () => {
        expect(maskPartition({ accord: 6, essai: 1, diplome: 9 })).toEqual({ accord: '<5', essai: '<5', diplome: 9 });
    });

    it('plusieurs cellules masquées : pas de masquage supplémentaire', () => {
        expect(maskPartition({ accord: 6, essai: 1, autre: 2 })).toEqual({ accord: 6, essai: '<5', autre: '<5' });
    });

    it('aucune cellule masquée : inchangé', () => {
        expect(maskPartition({ a: 5, b: 8, c: 0 })).toEqual({ a: 5, b: 8, c: 0 });
    });

    it('jamais une unique cellule masquée sur une partition à total publié', () => {
        for (let a = 0; a <= 12; a++)
            for (let b = 0; b <= 12; b++)
                for (let c = 0; c <= 12; c++) {
                    const out = maskPartition({ a, b, c });
                    const masked = Object.values(out).filter((v) => v === '<5').length;
                    expect(masked).not.toBe(1);
                }
    });
});
