import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import { createSseChannel, sseKey } from '../sseChannel';
import { syncWithRegion } from '../../../db/tenant';
import { addClient, pushToUser } from '../../notifications/sse';

function fakeResponse(lines: string[]) {
    return { write: (chunk: string) => {
        lines.push(chunk);
        return true;
    } } as unknown as Response;
}

describe('sseKey', () => {
    it('préfixe la clé avec la région', () => {
        expect(sseKey('annemasse', 5)).toBe('annemasse:5');
        expect(sseKey('reunion', 'abc')).toBe('reunion:abc');
    });
});

describe('createSseChannel', () => {
    it('isole le fan-out entre régions pour un même user id', () => {
        const channel = createSseChannel();
        const reunionChunks: string[] = [];
        const annemasseChunks: string[] = [];
        const reunion = fakeResponse(reunionChunks);
        const annemasse = fakeResponse(annemasseChunks);
        channel.addClient(sseKey('reunion', 5), reunion);
        channel.addClient(sseKey('annemasse', 5), annemasse);

        channel.notify(sseKey('annemasse', 5), { abId: 'ab-anne-ref' });

        expect(annemasseChunks.some((c) => c.includes('ab-anne-ref'))).toBe(true);
        expect(reunionChunks).toHaveLength(0);
    });
});

describe('pushToUser (wiring)', () => {
    it('route l’événement vers la région posée dans l’ALS', () => {
        const reunionChunks: string[] = [];
        const annemasseChunks: string[] = [];
        const reunion = fakeResponse(reunionChunks);
        const annemasse = fakeResponse(annemasseChunks);
        addClient(sseKey('reunion', 7), reunion);
        syncWithRegion('annemasse', () => {
            addClient(sseKey('annemasse', 7), annemasse);
            pushToUser(7, { event: 'notification', notification: { id: 'n-anne' } });
        });

        expect(annemasseChunks.some((c) => c.includes('"id":"n-anne"'))).toBe(true);
        expect(reunionChunks).toHaveLength(0);
    });
});