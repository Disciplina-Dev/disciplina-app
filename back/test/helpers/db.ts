import pool from '../../src/db/mysql/connection';
import { CandidateModel } from '../../src/db/mongo/schemas/candidate.schema';
import { NeedsAnalysisModel } from '../../src/db/mongo/schemas/needsAnalysis.schema';
import { OfferModel } from '../../src/db/mongo/schemas/offer.schema';

export async function truncateMysql(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE company_history');
        await conn.query('TRUNCATE TABLE companies');
        await conn.query('TRUNCATE TABLE companies_blacklist');
        await conn.query('TRUNCATE TABLE match_link');
        await conn.query('TRUNCATE TABLE interview_access');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('TRUNCATE TABLE refresh_tokens');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
}

export async function dropMongo(): Promise<void> {
    await CandidateModel.deleteMany({});
    await NeedsAnalysisModel.deleteMany({});
    await OfferModel.deleteMany({});
}
