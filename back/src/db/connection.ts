import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env'});

console.log(process.env.MYSQL_USER || 'root');
const pool: Pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'sql-db',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'UTF8MB4_UNICODE_CI',
});

export async function getConnection(): Promise<PoolConnection> {
  return pool.getConnection();
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const [rows] = await pool.execute(sql, params as (string | number)[]);
  return rows as T;
}

export default pool;