/**
 * One-shot migration: backfill matched_candidate[].status = 'RETAINED'
 * for all existing entries that have no status field.
 *
 * Run with: mongosh <connection-string> scripts/migrate-matched-candidate-status.js
 */
db = db.getSiblingDB('human_ressources');

const result = db.jobs.updateMany(
    { 'matched_candidate.0': { $exists: true } },
    { $set: { 'matched_candidate.$[el].status': 'RETAINED' } },
    { arrayFilters: [{ 'el.status': { $exists: false } }] },
);

print(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
