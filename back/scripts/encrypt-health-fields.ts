/**
 * Chiffrement des données de santé / handicap / contact d'urgence (GDPR_INF_02.3) :
 * ramène `identity.psh_referral_request`, `synthesis.special_needs`,
 * `synthesis.pedagogical_recommendations.psh_specific_support` et `emergency_contact`
 * vers la clé ACTIVE (`HEALTH_ENCRYPTION_KEY` + `HEALTH_KDF_SALT`).
 *
 * Traite, par tenant et par champ :
 * - valeur en clair                         → chiffrée ;
 * - chiffrée avec une autre clé (*_PREVIOUS) → déchiffrée puis ré-chiffrée ;
 * - déjà à la clé active                    → ignorée (idempotent, rejouable).
 *
 * Usage (depuis back/, avec l'environnement de production) :
 *   npx ts-node scripts/encrypt-health-fields.ts --tenant all --dry-run   # inventaire seul
 *   npx ts-node scripts/encrypt-health-fields.ts --tenant all             # applique
 *   npx ts-node scripts/encrypt-health-fields.ts --tenant all --verify    # contrôle lecture seule (AC)
 *
 * --tenant disciplina | annemasse | all (défaut : all)
 * Code de sortie ≠ 0 si une fiche échoue ou si --verify trouve un écart.
 * Les valeurs ne sont jamais affichées. Faire un backup (scripts/backup.sh) avant d'appliquer.
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env';
import {
    ACTIVE_HEALTH_KID,
    decryptHealthValue,
    isEncryptedHealth,
    reencryptHealthValue,
} from '../src/external/crypto/health-cipher';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verify = args.includes('--verify');
const tenantArg = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : 'all';

const FIELDS = [
    'identity.psh_referral_request',
    'synthesis.special_needs',
    'synthesis.pedagogical_recommendations.psh_specific_support',
    'emergency_contact',
] as const;

// Même résolution d'URI que `src/db/mongo/connection.ts`.
const TENANT_URIS: Record<string, string> = {
    disciplina:
        env.NODE_ENV === 'production'
            ? env.MONGO_URI!
            : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`,
    annemasse:
        env.NODE_ENV === 'production'
            ? env.MONGO_ANNEMASSE_URI!
            : `mongodb://${env.MONGO_ANNEMASSE_USERNAME ?? env.MONGO_ROOT_USERNAME}:${env.MONGO_ANNEMASSE_PASSWORD ?? env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_ANNEMASSE_DATABASE}?authSource=admin`,
};

interface Counts {
    plaintext: number;
    rotated: number;
    current: number;
    skipped: number;
    failed: number;
}

function getPath(doc: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], doc);
}

async function processTenant(name: string, uri: string): Promise<Counts> {
    const counts: Counts = { plaintext: 0, rotated: 0, current: 0, skipped: 0, failed: 0 };
    const conn = await mongoose.createConnection(uri).asPromise();
    try {
        const candidates = conn.collection('candidates');
        const cursor = candidates.find({ $or: FIELDS.map((f) => ({ [f]: { $exists: true, $ne: null } })) });

        for await (const doc of cursor) {
            const id = doc._id as unknown as object;
            try {
                // Un seul updateOne par fiche : filtre optimiste sur les valeurs lues, $set des champs modifiés.
                const filter: Record<string, unknown> = { _id: id };
                const set: Record<string, string> = {};
                const actions: Array<'plaintext' | 'rotated'> = [];

                for (const field of FIELDS) {
                    const stored = getPath(doc, field);
                    if (stored === undefined || stored === null) continue;

                    if (verify) {
                        if (!isEncryptedHealth(stored)) throw new Error(`${field} : en clair`);
                        if (stored.split(':')[1] !== ACTIVE_HEALTH_KID)
                            throw new Error(`${field} : pas à la clé active`);
                        decryptHealthValue(stored);
                        counts.current++;
                        continue;
                    }

                    const { value, action } = reencryptHealthValue(stored);
                    if (action === 'current') {
                        counts.current++;
                        continue;
                    }
                    filter[field] = stored;
                    set[field] = value;
                    actions.push(action);
                }

                if (actions.length === 0) continue;
                if (dryRun) {
                    for (const a of actions) counts[a]++;
                    continue;
                }
                const res = await candidates.updateOne(filter, { $set: set });
                if (res.modifiedCount === 1) for (const a of actions) counts[a]++;
                else counts.skipped++;
            } catch (err) {
                console.error(`❌ [${name}] ${String(id)} : ${(err as Error).message}`);
                counts.failed++;
            }
        }
    } finally {
        await conn.close();
    }
    return counts;
}

async function main(): Promise<void> {
    const tenants = tenantArg === 'all' ? Object.keys(TENANT_URIS) : [tenantArg];
    for (const t of tenants) {
        if (!TENANT_URIS[t]) throw new Error(`Tenant inconnu : ${t} (disciplina | annemasse | all)`);
    }

    const mode = verify ? 'verify' : dryRun ? 'dry-run' : 'apply';
    console.log(`Chiffrement données de santé — mode ${mode} — clé active kid=${ACTIVE_HEALTH_KID}`);

    let bad = 0;
    for (const t of tenants) {
        const c = await processTenant(t, TENANT_URIS[t]);
        console.log(
            `[${t}] champs en clair: ${c.plaintext} — ré-encryptés: ${c.rotated} — déjà à jour: ${c.current} — fiches ignorées (modifiées entre-temps, à relancer): ${c.skipped} — échecs: ${c.failed}`,
        );
        bad += c.failed + c.skipped;
    }

    if (bad > 0) {
        console.error(`\n${bad} fiche(s) à traiter / corriger.`);
        process.exit(1);
    }
    console.log('\nOK.');
}

main().catch((err) => {
    console.error('❌ Chiffrement échoué :', err);
    process.exit(1);
});
