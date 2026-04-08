"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const companies_1 = __importDefault(require("./routes/companies"));
const relances_1 = __importDefault(require("./routes/relances"));
const app = (0, express_1.default)();
// ── Middleware ────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        // Autorise tous les localhost en dev (ou sans origin = Postman/curl)
        if (!origin || origin.startsWith('http://localhost'))
            return cb(null, true);
        cb(new Error('CORS non autorisé'));
    },
    credentials: true,
}));
app.use(express_1.default.json());
// ── Routes ────────────────────────────────────────────────────
app.use('/api/companies', companies_1.default);
app.use('/api/relances', relances_1.default);
// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
});
exports.default = app;
