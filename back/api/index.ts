import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/index';

// Reuse the app (and its DB connections) across invocations on a warm lambda
let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[handler] incoming', req.method, req.url, 'cold=', appPromise === undefined);
    appPromise ??= createApp();
    let app;
    try {
        app = await appPromise;
        // eslint-disable-next-line no-console
        console.log('[handler] app ready');
    } catch (err) {
        // A failed cold start (DB unreachable, migrations, env…) must not be
        // cached as a permanently-rejected promise, or every later request 500s.
        appPromise = undefined;
        // eslint-disable-next-line no-console
        console.error('createApp failed', err);
        res.statusCode = 500;
        res.end('Server initialization failed');
        return;
    }
    // Keep the lambda alive until the response is fully flushed. Express'
    // app(req, res) dispatches synchronously and does not return a promise, so
    // without this Vercel freezes/tears down the function while async route
    // work (DB writes, Drive upload) is still in flight → aborted responses.
    await new Promise<void>((resolve) => {
        res.on('finish', resolve);
        res.on('close', resolve);
        app(req, res);
    });
}
