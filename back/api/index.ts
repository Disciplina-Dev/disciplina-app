import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/index';

// Reuse the app (and its DB connections) across invocations on a warm lambda
let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    appPromise ??= createApp();
    const app = await appPromise;
    app(req, res);
}
