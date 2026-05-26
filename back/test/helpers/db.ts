import pool from '../../src/db/mysql/connection';
import { CandidateModel } from '../../src/db/mongo/schemas/candidate.schema';
import { JobModel } from '../../src/db/mongo/schemas/job.schema';

export async function truncateMysql(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('TRUNCATE TABLE companies');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
}

export async function dropMongo(): Promise<void> {
    await CandidateModel.deleteMany({});
    await JobModel.deleteMany({});
}
