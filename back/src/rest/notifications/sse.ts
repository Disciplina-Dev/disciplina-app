import { createSseChannel, sseKey } from '../shared/sseChannel';
import { getRegion } from '../../db/tenant';

// Connexions SSE ouvertes, indexées par `region:userID`.
const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
/** Pousse un événement temps réel vers toutes les connexions ouvertes d'un utilisateur (région de l'ALS courante). */
export function pushToUser(userId: number, data: unknown): void {
    channel.notify(sseKey(getRegion(), userId), data);
}
