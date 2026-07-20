import { createSseChannel } from '../shared/sseChannel';

// Connexions SSE indexées par userID.
const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
export const notifyUser = channel.notify;
