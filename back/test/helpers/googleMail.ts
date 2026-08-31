import { vi } from 'vitest';
import { GoogleGmailService } from '../../src/external/google/gmail.service';
import { GoogleDriveService } from '../../src/external/google/drive.service';

export interface GoogleMailSpies {
    sendEmail: ReturnType<typeof vi.spyOn>;
    downloadFile: ReturnType<typeof vi.fn>;
}

/**
 * Several rest controllers (`relance`, `yousign`, `SignedAbProcessor`) instantiate
 * `GoogleGmailService`/rely on `GoogleDriveService` at module load time, so a factory
 * `vi.mock` can't reach them once the app has booted (see HOWTOTEST.md §9) — spy on the
 * prototype/static method instead. Call from `beforeEach`; pair with `vi.restoreAllMocks()`
 * in `afterEach`.
 */
export function spyOnGoogleMail(signatureBytes = 'fake-signature-bytes'): GoogleMailSpies {
    const downloadFile = vi.fn().mockResolvedValue({ buffer: Buffer.from(signatureBytes) });
    const sendEmail = vi.spyOn(GoogleGmailService.prototype, 'sendEmail').mockResolvedValue(undefined);
    vi.spyOn(GoogleDriveService, 'fromTokens').mockReturnValue({ downloadFile } as any);
    return { sendEmail, downloadFile };
}
