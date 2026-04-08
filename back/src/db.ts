import mysql from 'mysql2/promise'
import { config } from 'dotenv'
import { join } from 'path'

// Charge le .env depuis la racine du monorepo (dossier parent de back/)
config({ path: join(__dirname, '../../.env') })

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? 'disciplina-ab',
  waitForConnections: true,
  connectionLimit: 10,
})
