import type { Response } from 'express';

/**
 * Registre SSE générique : des connexions `Response` groupées par clé (candidat,
 * utilisateur…). Chaque module SSE (classmarker, yousign, notifications) en crée
 * une instance au lieu de recopier la même Map + addClient/removeClient/notify.
 */
export interface SseChannel {
    addClient(key: string, res: Response): void;
    removeClient(key: string, res: Response): void;
    notify(key: string | number, data: unknown): void;
}

export function createSseChannel(): SseChannel {
    const clients = new Map<string, Set<Response>>();

    return {
        addClient(key, res) {
            if (!clients.has(key)) clients.set(key, new Set());
            clients.get(key)!.add(res);
        },
        removeClient(key, res) {
            const set = clients.get(key);
            if (!set) return;
            set.delete(res);
            if (set.size === 0) clients.delete(key);
        },
        notify(key, data) {
            const set = clients.get(String(key));
            if (!set?.size) return;
            const payload = `data: ${JSON.stringify(data)}\n\n`;
            set.forEach((res) => {
                try {
                    res.write(payload);
                } catch {
                    /* client déconnecté */
                }
            });
        },
    };
}
