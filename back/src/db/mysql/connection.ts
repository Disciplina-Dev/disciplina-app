import fs from 'fs';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env';
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

const pool: Pool =
    env.NODE_ENV === 'production'
        ? mysql.createPool({
              uri: env.MYSQL_URI!,
              // TiDB Cloud Serverless rejects insecure transport
              ssl: productionSsl,
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
