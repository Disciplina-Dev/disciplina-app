import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import app from './app'
import { pool } from './config/db'

const PORT = Number(process.env.PORT) || 3001

async function main() {
  // Vérifier la connexion DB avant de démarrer
  try {
    const conn = await pool.getConnection()
    conn.release()
    console.log('✅ MySQL connecté')
  } catch (err) {
    console.error('❌ Impossible de se connecter à MySQL :', err)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`🚀 Serveur Disciplina démarré sur http://localhost:${PORT}`)
    console.log(`   Health : http://localhost:${PORT}/api/health`)
  })
}

main()
