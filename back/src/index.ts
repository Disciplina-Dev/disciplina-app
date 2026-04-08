import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(__dirname, '../../.env') })
import abRouter      from './routes/ab'
import yousignRouter from './routes/yousign'
import siretRouter   from './routes/siret'

const app  = express()
const PORT = process.env.PORT ?? 3001

const allowedOrigin = process.env.FRONT_URL
  ?? (process.env.NODE_ENV === 'production' ? '' : /^http:\/\/localhost:\d+$/)

app.use(cors({ origin: allowedOrigin }))
app.use(express.json())

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/ab',      abRouter)
app.use('/api/yousign', yousignRouter)
app.use('/api/siret',   siretRouter)

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[back] http://localhost:${PORT}`)
})
