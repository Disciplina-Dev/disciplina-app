"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
const PORT = Number(process.env.PORT) || 3001;
async function main() {
    // Vérifier la connexion DB avant de démarrer
    try {
        const conn = await db_1.pool.getConnection();
        conn.release();
        console.log('✅ MySQL connecté');
    }
    catch (err) {
        console.error('❌ Impossible de se connecter à MySQL :', err);
        process.exit(1);
    }
    app_1.default.listen(PORT, () => {
        console.log(`🚀 Serveur Disciplina démarré sur http://localhost:${PORT}`);
        console.log(`   Health : http://localhost:${PORT}/api/health`);
    });
}
main();
