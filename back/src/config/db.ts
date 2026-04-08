import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

export const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              Number(process.env.DB_PORT) || 3307,
  user:              process.env.MYSQL_USER  || 'toto',
  password:          process.env.MYSQL_PASSWORD || 'toto',
  database:          process.env.MYSQL_DATABASE || 'disciplina-ab',
  waitForConnections: true,
  connectionLimit:   10,
  timezone:          'Z',
  charset:           'utf8mb4',
})
