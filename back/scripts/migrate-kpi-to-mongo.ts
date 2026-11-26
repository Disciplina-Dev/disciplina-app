/**
 * Backfill manuel : MySQL commercial_kpi + rh_kpi → MongoDB `kpis` (#513).
 *
 * Réutilise migrateLegacyKpiTables() — la même logique tourne automatiquement
 * au boot du backend (qui, elle, drop les tables après import ; ce script ne
 * supprime rien). Idempotent : rejouable tant que MySQL existe encore.
 *
 * Usage (rootDir = src : dist n'embarque pas scripts/, passer par vite-node) :
 *   npx vite-node scripts/migrate-kpi-to-mongo.ts
 */

import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { migrateLegacyKpiTables, LegacyKpiSql } from '../src/db/mongo/legacyKpiImport';

const dbHost = process.env.MYSQL_HOST || 'localhost';
const dbPort = Number(process.env.MYSQL_PORT || 3306);
const dbUser = process.env.MYSQL_USER || 'root';
const dbPassword = process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || '';
const dbName = process.env.MYSQL_DATABASE || 'disciplina';
const mongoDbName = process.env.MONGO_DB_NAME || 'human_ressources';
const mongoUri =
    process.env.MONGO_URI ||
    `mongodb://${process.env.MONGO_ROOT_USERNAME || 'mongo-user'}:${process.env.MONGO_ROOT_PASSWORD || ''}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || '27017'}/${mongoDbName}?authSource=admin`;

async function main(): Promise<void> {
    const pool = mysql.createPool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
    });
    await mongoose.connect(mongoUri);

    try {
        // Index unique + partiel en place avant toute écriture.
        await (await import('../src/db/mongo/schemas/kpi.schema')).KpiModel.syncIndexes();

        const conn = await pool.getConnection();
        const sql: LegacyKpiSql = {
            all: async (query, params) => {
                const [rows] = await conn.query(query, params);
                return rows as Record<string, unknown>[];
            },
        };
        const result = await migrateLegacyKpiTables(sql);
        conn.release();
        console.log(`\n✅ Backfill terminé : ${result.commercial} commercial + ${result.rh} rh`);
        console.log('Tables MySQL conservées (drop automatique au boot du backend).');
    } catch (err) {
        console.error('❌ Backfill échoué :', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
        await mongoose.disconnect();
    }
}

main();
