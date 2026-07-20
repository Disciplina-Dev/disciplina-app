import { createSseChannel } from '../shared/sseChannel';

// Connexions SSE ouvertes, indexées par userID.
const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
/** Pousse un événement temps réel vers toutes les connexions ouvertes d'un utilisateur. */
export const pushToUser = channel.notify;
