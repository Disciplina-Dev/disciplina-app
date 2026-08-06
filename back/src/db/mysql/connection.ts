import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env';
import { logger } from '../../external/logger';

const pool: Pool =
    env.NODE_ENV === 'production'
        ? mysql.createPool({
              uri: env.MYSQL_URI!,
              // TiDB Cloud Serverless rejects insecure transport — TLS is mandatory.
              ssl: { minVersion: 'TLSv1.2' },
              waitForConnections: true,
              connectionLimit: 10,
              queueLimit: 0,
              dateStrings: true,
              charset: 'utf8mb4',
          })
        : mysql.createPool({
              host: env.MYSQL_HOST,
              port: env.MYSQL_PORT,
              user: env.MYSQL_USER,
              // Compte applicatif non-root dès que MYSQL_PASSWORD est fourni ; sinon on
              // retombe sur le mot de passe root pour ne pas casser les installations
              // antérieures à la création de `disciplina_app`.
              password: env.MYSQL_PASSWORD ?? env.MYSQL_ROOT_PASSWORD,
              database: env.MYSQL_DATABASE,
              waitForConnections: true,
              connectionLimit: 10,
              queueLimit: 0,
              dateStrings: true,
              charset: 'utf8mb4',
          });

export async function connectMySQL(): Promise<void> {
    const conn = await pool.getConnection();
    conn.release();
    logger.info('MySQL connected');
}

export async function getConnection(): Promise<PoolConnection> {
    return pool.getConnection();
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await pool.execute(sql, params as (string | number)[]);
    return rows as T;
}

export default pool;
