import fs from 'fs';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env';
import { getRegion } from '../tenant';
import type { Region } from '../../types/tenant';
import { logger } from '../../external/logger';

// TiDB Cloud Serverless rejects insecure transport — TLS is mandatory.
// Un MySQL auto-hébergé présente en revanche le certificat auto-signé qu'il
// génère à l'init : la chaîne n'est pas vérifiable via les CA système
// («self-signed certificate in certificate chain») et le CN du certificat est
// `MySQL_Server_<version>_Auto_Generated_Server_Certificate`, jamais le nom
// d'hôte. On reproduit donc le mode `--ssl-mode=VERIFY_CA` du client mysql :
// chaîne vérifiée contre la CA fournie, identité d'hôte non contrôlée.
const productionSsl = env.MYSQL_SSL_CA
    ? {
          minVersion: 'TLSv1.2' as const,
          ca: fs.readFileSync(env.MYSQL_SSL_CA, 'utf8'),
          checkServerIdentity: () => undefined,
      }
    : { minVersion: 'TLSv1.2' as const };

interface PoolConfig {
    uri?: string;
    database?: string;
    user?: string;
    password?: string;
}

function createPool(cfg: PoolConfig): Pool {
    if (env.NODE_ENV === 'production') {
        return mysql.createPool({
            uri: cfg.uri!,
            // TiDB Cloud Serverless rejects insecure transport
            ssl: productionSsl,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            dateStrings: true,
            charset: 'utf8mb4',
        });
    }
    return mysql.createPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: cfg.user,
        // Compte applicatif non-root dès que MYSQL_PASSWORD est fourni ; sinon on
        // retombe sur le mot de passe root pour ne pas casser les installations
        // antérieures à la création de `disciplina_app`.
        password: cfg.password,
        database: cfg.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true,
        charset: 'utf8mb4',
    });
}

export const pools: Record<Region, Pool> = {
    reunion: createPool({
        uri: env.MYSQL_URI,
        database: env.MYSQL_DATABASE,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD ?? env.MYSQL_ROOT_PASSWORD,
    }),
    annemasse: createPool({
        uri: env.MYSQL_ANNEMASSE_URI,
        database: env.MYSQL_ANNEMASSE_DATABASE,
        user: env.MYSQL_ANNEMASSE_USER ?? env.MYSQL_USER,
        password: env.MYSQL_ANNEMASSE_PASSWORD ?? env.MYSQL_PASSWORD ?? env.MYSQL_ROOT_PASSWORD,
    }),
};

export function getPool(region: Region = getRegion()): Pool {
    return pools[region];
}

export async function connectMySQL(): Promise<void> {
    const regions = await Promise.all(
        (Object.entries(pools) as [Region, Pool][]).map(async ([region, pool]) => {
            const conn = await pool.getConnection();
            conn.release();
            return region;
        }),
    );
    for (const region of regions) {
        logger.info(`MySQL connected (${region})`);
    }
}

/**
 * Ferme les pools. Utilisé par les tests : chaque fichier vitest ré-instancie ce
 * module (registre isolé) donc ses propres pools ; sans fermeture, les connexions
 * s'accumulent jusqu'au `max_connections` de MySQL.
 */
export async function closeMySQL(): Promise<void> {
    await Promise.all(Object.values(pools).map((pool) => pool.end()));
}

export async function getConnection(): Promise<PoolConnection> {
    return getPool().getConnection();
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await getPool().execute(sql, params as (string | number)[]);
    return rows as T;
}

export default pools.reunion;