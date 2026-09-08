import pool from '../../src/db/mysql/connection';
import { CandidateModel } from '../../src/db/mongo/schemas/candidate.schema';
import { NeedsAnalysisModel } from '../../src/db/mongo/schemas/needsAnalysis.schema';
import { OfferModel } from '../../src/db/mongo/schemas/offer.schema';
import { KpiModel } from '../../src/db/mongo/schemas/kpi.schema';

const CLEARED_TABLES = [
    'external_link',
    'company_history',
    'companies',
    'companies_blacklist',
    'match_link',
    // interview_access : table conservée (dépréciée) ; le flux entretien vit dans external_access (reference 3).
    // rh_kpi / commercial_kpi : supprimées (#513), les buckets vivent dans
    // Mongo `kpis`, vidés via dropMongo().
    'todos',
    'todo_groups',
    'users',
    'refresh_tokens',
];

/**
 * Vide les tables MySQL entre deux tests.
 *
 * DELETE et non TRUNCATE : TRUNCATE exige le privilège DROP, que le compte applicatif
 * `disciplina_app` n'a volontairement pas (il ouvrirait DROP DATABASE, cf.
 * database/mysql/mysql-init.sql). Les tests tournent ainsi avec exactement les droits de
 * production, et toute requête réclamant un privilège de trop échoue ici plutôt qu'en prod.
 *
 * DELETE ne remet pas l'AUTO_INCREMENT à zéro, contrairement à TRUNCATE : on le fait
 * explicitement, plusieurs tests supposant que les identifiants repartent de 1.
 */
export async function truncateMysql(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of CLEARED_TABLES) {
            try {
                await conn.query(`DELETE FROM ${table}`);
                await conn.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
            } catch (e: unknown) {
                const msg = String((e as any)?.message ?? '');
                // Table may not exist yet before migrations (e.g. todo_groups on old DB)
                if (msg.includes("doesn't exist") || msg.includes('Unknown table') || msg.includes('ER_NO_SUCH_TABLE')) continue;
                throw e;
            }
        }
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
}

export async function dropMongo(): Promise<void> {
    await CandidateModel.deleteMany({});
    await NeedsAnalysisModel.deleteMany({});
    await OfferModel.deleteMany({});
    // Buckets KPI (ex-tables MySQL commercial_kpi / rh_kpi) : vidés comme elles
    // l'étaient pour isoler chaque test.
    await KpiModel.deleteMany({});
}
