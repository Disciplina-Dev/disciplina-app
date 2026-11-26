import { createSseChannel, sseKey } from '../shared/sseChannel';
import { getRegion } from '../../db/tenant';

// Connexions SSE indexées par `region:candidateId`.
const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
export function notifyCandidate(candidateId: string, data: unknown): void {
    channel.notify(sseKey(getRegion(), candidateId), data);
}
