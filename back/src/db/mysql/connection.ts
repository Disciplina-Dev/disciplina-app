import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env';

console.log(env.MYSQL_HOST);
const pool: Pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: process.env.NODE_ENV === 'test' ? env.MYSQL_PORT : 3306,
    user: 'root',
    password: env.MYSQL_ROOT_PASSWORD,
    database: 'disciplina',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export async function getConnection(): Promise<PoolConnection> {
    return pool.getConnection();
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await pool.execute(sql, params as (string | number)[]);
    return rows as T;
}

export default pool;
