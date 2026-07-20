import { createSseChannel } from '../shared/sseChannel';

const channel = createSseChannel();

export const addClient = channel.addClient;
export const removeClient = channel.removeClient;
export const notifyCandidate = channel.notify;
