import type { Response } from 'express';

// keyed by userID (string)
const clients = new Map<string, Set<Response>>();

export function addClient(userID: string, res: Response): void {
    if (!clients.has(userID)) clients.set(userID, new Set());
    clients.get(userID)!.add(res);
}

export function removeClient(userID: string, res: Response): void {
    const set = clients.get(userID);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(userID);
}

export function notifyUser(userID: string | number, data: unknown): void {
    const key = String(userID);
    const set = clients.get(key);
    if (!set?.size) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    set.forEach((res) => {
        try { res.write(payload); } catch { /* client gone */ }
    });
}
