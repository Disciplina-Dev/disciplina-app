import type { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function addClient(candidateId: string, res: Response): void {
    if (!clients.has(candidateId)) clients.set(candidateId, new Set());
    clients.get(candidateId)!.add(res);
}

export function removeClient(candidateId: string, res: Response): void {
    const set = clients.get(candidateId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(candidateId);
}

export function notifyCandidate(candidateId: string, data: unknown): void {
    const set = clients.get(candidateId);
    if (!set?.size) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    set.forEach(res => {
        try { res.write(payload); } catch { /* client gone */ }
    });
}
