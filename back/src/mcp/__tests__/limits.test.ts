import { describe, it, expect } from 'vitest';
import { MAX_PAGE_SIZE, pageOf } from '../limits';

describe('pageOf', () => {
    const rows = Array.from({ length: 120 }, (_, i) => i);

    it('plafonne à MAX_PAGE_SIZE par défaut et indique la page suivante', () => {
        const page = pageOf(rows);
        expect(page.items).toHaveLength(MAX_PAGE_SIZE);
        expect(page).toMatchObject({ total: 120, offset: 0, nextOffset: MAX_PAGE_SIZE });
    });

    it('termine avec nextOffset null', () => {
        const page = pageOf(rows, 50, 100);
        expect(page.items).toHaveLength(20);
        expect(page.nextOffset).toBeNull();
    });

    it('renvoie une page vide au-delà de la fin', () => {
        expect(pageOf(rows, 50, 500)).toMatchObject({ items: [], nextOffset: null, total: 120 });
    });
});
