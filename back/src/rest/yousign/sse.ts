import { createSseChannel, sseKey } from '../shared/sseChannel';
import { getRegion } from '../../db/tenant';

// Connexions SSE indexées par `region:userID`.
const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
export function notifyUser(userId: number, data: unknown): void {
    channel.notify(sseKey(getRegion(), userId), data);
}
