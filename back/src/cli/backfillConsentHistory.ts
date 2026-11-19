/**
 * Historique des consentements candidats (GDPR_INF_08.2) : aligne la table MySQL
 * `candidate_consent_history` sur les fiches MongoDB (`consentments`, source de
 * vérité du traitement).
 *
 * Par fiche ayant un champ `consentments` :
 * - aucun historique     → reprise initiale : un GRANT par type accordé, daté du
 *                           `consent_date` de la fiche, source BACKFILL ;
 * - historique divergent → événements de correction (GRANT/WITHDRAW) datés de
 *                           maintenant, source BACKFILL (écriture MySQL échouée,
 *                           journalisée par le backend) ;
 * - historique cohérent  → ignorée (idempotent, rejouable).
 *
 * Compilé avec le backend (dist/cli/) pour tourner dans l'image de production,
 * qui n'a ni ts-node ni accès hôte aux bases. Lancé par `scripts/deploy.sh`.
 *
 *   Production : docker compose -f docker-compose.yaml -f docker-compose.prod.yaml \
 *                  exec -T backend node dist/cli/backfillConsentHistory.js --tenant all [--dry-run|--verify]
 *   Dev        : cd back && npx ts-node src/cli/backfillConsentHistory.ts --tenant all [--dry-run|--verify]
 *
 * --tenant reunion | annemasse | all (défaut : all)
 * Code de sortie ≠ 0 si une fiche échoue, ou si --verify / --dry-run trouve un écart.
 * Aucune donnée personnelle journalisée (UUID des fiches en échec uniquement).
 */

import mongoose from 'mongoose';
import { closeMySQL } from '../db/mysql/connection';
import { mongoUriForRegion } from '../db/mongo/connection';
import { withRegion } from '../db/tenant';
import { logger } from '../external/logger';
import { ConsentHistoryService, reconcileEvents } from '../services/ConsentHistoryService';
import type { CandidateConsentments } from '../types/candidate.types';
import { isRegion, VALID_REGIONS, type Region } from '../types/tenant';

export type BackfillMode = 'apply' | 'dry-run' | 'verify';

export interface BackfillCounts {
    consistent: number;
    initial: number;
    corrected: number;
    events: number;
    failed: number;
}

interface CandidateConsentDoc {
    _id: string;
    consentments: Partial<CandidateConsentments>;
}

const BATCH_SIZE = 500;
const service = new ConsentHistoryService();

async function processBatch(batch: CandidateConsentDoc[], counts: BackfillCounts, mode: BackfillMode): Promise<void> {
    const latest = await service.latestActions(batch.map((doc) => String(doc._id)));
    const now = new Date();
    for (const doc of batch) {
        const candidateId = String(doc._id);
        try {
            const events = reconcileEvents(candidateId, doc.consentments, latest.get(candidateId), now);
            if (events.length === 0) {
                counts.consistent++;
                continue;
            }
            if (latest.has(candidateId)) counts.corrected++;
            else counts.initial++;
            counts.events += events.length;
            if (mode === 'apply') await service.record(events);
        } catch (error) {
            logger.error({ err: error, candidateId }, 'Consent history backfill failed for candidate');
            counts.failed++;
        }
    }
}

async function processRegion(region: Region, mode: BackfillMode): Promise<BackfillCounts> {
    const counts: BackfillCounts = { consistent: 0, initial: 0, corrected: 0, events: 0, failed: 0 };
    const conn = await mongoose.createConnection(mongoUriForRegion(region)).asPromise();
    try {
        const cursor = conn
            .collection('candidates')
            .find({ consentments: { $exists: true, $ne: null } }, { projection: { consentments: 1 } });
        let batch: CandidateConsentDoc[] = [];
        for await (const doc of cursor) {
            batch.push(doc as unknown as CandidateConsentDoc);
            if (batch.length >= BATCH_SIZE) {
                await withRegion(region, () => processBatch(batch, counts, mode));
                batch = [];
            }
        }
        if (batch.length > 0) await withRegion(region, () => processBatch(batch, counts, mode));
    } finally {
        await conn.close();
    }
    return counts;
}

/** Renvoie le nombre de fiches en écart (hors mode apply) ou en échec : 0 = OK. */
export async function runConsentHistoryBackfill(regions: Region[], mode: BackfillMode): Promise<number> {
    let bad = 0;
    for (const region of regions) {
        const c = await processRegion(region, mode);
        logger.info(
            {
                tenant: region,
                mode,
                consistent: c.consistent,
                initialBackfill: c.initial,
                corrected: c.corrected,
                events: c.events,
                failed: c.failed,
            },
            mode === 'apply' ? 'Consent history backfill applied' : 'Consent history backfill check',
        );
        bad += c.failed;
        if (mode !== 'apply') bad += c.initial + c.corrected;
    }
    return bad;
}

function parseArgs(argv: string[]): { regions: Region[]; mode: BackfillMode } {
    const mode: BackfillMode = argv.includes('--verify') ? 'verify' : argv.includes('--dry-run') ? 'dry-run' : 'apply';
    const tenant = argv.includes('--tenant') ? argv[argv.indexOf('--tenant') + 1] : 'all';
    if (tenant === 'all') return { regions: [...VALID_REGIONS], mode };
    if (!isRegion(tenant)) throw new Error(`Unknown tenant "${tenant}" (reunion | annemasse | all)`);
    return { regions: [tenant], mode };
}

async function main(): Promise<void> {
    let exitCode = 0;
    try {
        const { regions, mode } = parseArgs(process.argv.slice(2));
        const bad = await runConsentHistoryBackfill(regions, mode);
        if (bad > 0) {
            logger.warn({ candidates: bad, mode }, 'Consent history: candidates to backfill or fix');
            exitCode = 1;
        }
    } catch (error) {
        logger.error({ err: error }, 'Consent history backfill aborted');
        exitCode = 1;
    } finally {
        await closeMySQL().catch(() => undefined);
    }
    process.exit(exitCode);
}

if (require.main === module) {
    void main();
}
