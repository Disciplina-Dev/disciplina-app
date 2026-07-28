/**
 * One-shot migration: replace flat TP/missions fields by a `desired_tp` array
 * on positions (needs_analysis) and offers.
 *
 * Before: tp_type, missions, description_missions, other_missions,
 *         other_description_missions at the position/offer root.
 * After:  desired_tp: [{ tp_type, missions, description_missions,
 *         other_missions, other_description_missions }] and the flat fields unset.
 *
 * Idempotent: a doc that already has a non-empty desired_tp is left untouched.
 *
 * Run with: mongosh <connection-string> scripts/migrate-position-desired-tp.js
 */
db = db.getSiblingDB('human_ressources');

const FLAT_FIELDS = ['tp_type', 'missions', 'description_missions', 'other_missions', 'other_description_missions'];

function toDesiredTp(source) {
    return {
        tp_type: source.tp_type ?? null,
        missions: source.missions ?? [],
        description_missions: source.description_missions ?? [],
        other_missions: source.other_missions ?? null,
        other_description_missions: source.other_description_missions ?? null,
    };
}

function hasFlatFields(source) {
    return FLAT_FIELDS.some((field) => source[field] !== undefined);
}

// ─── needs_analysis.positions[] ──────────────────────────────────────────────
let needsAnalysisModified = 0;
db.needs_analysis.find({ 'positions.0': { $exists: true } }).forEach((doc) => {
    let changed = false;
    const positions = (doc.positions || []).map((position) => {
        if ((position.desired_tp && position.desired_tp.length) || !hasFlatFields(position)) return position;
        changed = true;
        const cleaned = { ...position, desired_tp: [toDesiredTp(position)] };
        FLAT_FIELDS.forEach((field) => delete cleaned[field]);
        return cleaned;
    });
    if (changed) {
        db.needs_analysis.updateOne({ _id: doc._id }, { $set: { positions } });
        needsAnalysisModified += 1;
    }
});
print(`needs_analysis modified: ${needsAnalysisModified}`);

// ─── offers ──────────────────────────────────────────────────────────────────
let offersModified = 0;
db.offers.find({ tp_type: { $exists: true } }).forEach((offer) => {
    if (offer.desired_tp && offer.desired_tp.length) return;
    const unset = {};
    FLAT_FIELDS.forEach((field) => {
        unset[field] = '';
    });
    db.offers.updateOne({ _id: offer._id }, { $set: { desired_tp: [toDesiredTp(offer)] }, $unset: unset });
    offersModified += 1;
});
print(`offers modified: ${offersModified}`);
