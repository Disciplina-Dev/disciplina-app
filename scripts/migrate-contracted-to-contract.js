// Migration script: rename CandidateStatus CONTRACTED → CONTRACT
// Run this before applying the new validator in patchCandidatesValidator()
// Command: mongosh [connection_string] --file migrate-contracted-to-contract.js

const db = db.getSiblingDB('human_ressources');

console.log('Migrating candidates status: CONTRACTED → CONTRACT...');

const result = db.candidate.updateMany(
    { status: 'CONTRACTED' },
    { $set: { status: 'CONTRACT' } }
);

console.log(`Updated ${result.modifiedCount} documents`);

// Verify no CONTRACTED remains
const distinctStatuses = db.candidate.distinct('status');
console.log('Current statuses:', distinctStatuses);

if (distinctStatuses.includes('CONTRACTED')) {
    console.error('⚠️  WARNING: CONTRACTED still exists in DB');
    process.exit(1);
}

console.log('✅ Migration complete');
