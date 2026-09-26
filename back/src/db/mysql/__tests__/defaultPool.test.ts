import { describe, expect, it } from 'vitest';
import pool from '../connection';
import { syncWithRegion } from '../../tenant';

const currentDb = async () => {
    const [rows] = await pool.query('SELECT DATABASE() AS db');
    return (rows as { db: string }[])[0].db;
};

describe('export default de connection.ts (DEBT-02)', () => {
    it('suit le tenant courant au lieu de rester figé sur réunion', async () => {
        expect(await syncWithRegion('annemasse', currentDb)).toBe('disciplina_annemasse');
        expect(await syncWithRegion('reunion', currentDb)).toBe('disciplina');
    });
});
