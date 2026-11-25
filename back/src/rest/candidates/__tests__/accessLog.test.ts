import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pool from '../../../db/mysql/connection';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { CandidateService } from '../../../services/CandidateService';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
import { GoogleDriveService } from '../../../external/google/drive.service';
import { JobRole, Permission } from '../../../types/user.types';

/**
 * GDPR_INF_06.5 — journal d'accès : les lectures de fichiers et exports PDF
 * d'une fiche candidat laissent une ligne dans `candidate_access_log`.
 */

const BASE = `http://localhost:${env.API_PORT}/api/candidates`;
const CV_ID = 'drivecvfile01';

let rhId = 0;

function rhAuth() {
    return mintAuthCookies({
        id: rhId,
        email: 'rh-rest-access@test.local',
        role: JobRole.RH,
        permission: Permission.EMPLOYEE,
    });
}

async function get(path: string, auth = rhAuth()) {
    return fetch(`${BASE}${path}`, { headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader } });
}

async function seedCandidate(suffix: string): Promise<string> {
    const id = `cand-rest-access-${suffix}-${Date.now()}`;
    await new CandidateService().create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.AD],
        status: CandidateStatus.SEEKING,
        identity: { full_name: `Rest Access ${suffix}`, email: `${id}@test.local`, phone: '0600000000' } as any,
        drive_folder_id: 'folder-1',
        cv_link: `https://drive.google.com/file/d/${CV_ID}/view`,
    } as any);
    return id;
}

async function accessRows() {
    const [rows] = await pool.query<any[]>(
        'SELECT candidate_id, actor_id, actor_type, action FROM candidate_access_log ORDER BY id',
    );
    return rows as Array<{ candidate_id: string; actor_id: number; actor_type: string; action: string }>;
}

describe('candidate REST access log (GDPR_INF_06.5)', () => {
    beforeEach(async () => {
        await truncateMysql();
        const [res] = await pool.execute<any>(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ['rh-rest-access@test.local', 'Rita', 'Rest', 'not-a-real-hash', 1, 1, 'tok', 'ref'],
        );
        rhId = res.insertId;
        vi.spyOn(GoogleDriveService, 'fromTokens').mockReturnValue({
            downloadFile: vi.fn().mockResolvedValue({ buffer: Buffer.from('cv'), mimeType: 'application/pdf' }),
            listFolderFiles: vi.fn().mockResolvedValue([{ id: 'f1', name: 'a.pdf', mimeType: 'application/pdf' }]),
            getFileMeta: vi.fn().mockResolvedValue({ name: 'a.pdf', mimeType: 'application/pdf' }),
        } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs the AB PDF export', async () => {
        const id = await seedCandidate('pdf');

        const res = await get(`/${id}/pdf`);
        await res.arrayBuffer();

        expect(res.status).toBe(200);
        expect(await accessRows()).toEqual([
            { candidate_id: id, actor_id: rhId, actor_type: 'STAFF', action: 'PDF_EXPORT' },
        ]);
    });

    it('logs the CV download', async () => {
        const id = await seedCandidate('cv');

        const res = await get(`/${id}/cv-file`);

        expect(res.status).toBe(200);
        expect(await accessRows()).toEqual([
            { candidate_id: id, actor_id: rhId, actor_type: 'STAFF', action: 'CV_READ' },
        ]);
    });

    it('logs Drive folder listing and file content reads', async () => {
        const id = await seedCandidate('files');

        const list = await get(`/${id}/drive-files`);
        const content = await get(`/${id}/drive-files/f1/content`);
        await content.arrayBuffer();

        expect(list.status).toBe(200);
        expect(content.status).toBe(200);
        expect((await accessRows()).map((r) => r.action)).toEqual(['FILE_READ', 'FILE_READ']);
    });

    it('logs nothing when the caller is refused or the candidate is unknown', async () => {
        const id = await seedCandidate('denied');
        const outsider = mintAuthCookies({
            id: rhId,
            email: 'rh-rest-access@test.local',
            role: 'COMMERCIAL',
            permission: Permission.EMPLOYEE,
        });

        const forbidden = await get(`/${id}/cv-file`, outsider);
        const missing = await get('/unknown-candidate/cv-file');

        expect(forbidden.status).toBe(403);
        expect(missing.status).toBe(404);
        expect(await accessRows()).toHaveLength(0);
    });
});
