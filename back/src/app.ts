import express from 'express'
import cors from 'cors'
import companiesRouter from './routes/companies'
import relancesRouter  from './routes/relances'

const app = express()

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Autorise tous les localhost en dev (ou sans origin = Postman/curl)
    if (!origin || origin.startsWith('http://localhost')) return cb(null, true)
    cb(new Error('CORS non autorisé'))
  },
  credentials: true,
}))

app.use(express.json())

// ── Routes ────────────────────────────────────────────────────
app.use('/api/companies', companiesRouter)
app.use('/api/relances',  relancesRouter)

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' })
})

export default app
