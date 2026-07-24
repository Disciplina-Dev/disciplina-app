const ROOT = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
db = db.getSiblingDB('admin')
db.auth(ROOT, PASSWORD)

db = db.getSiblingDB('human_ressources');

db.createCollection('ab_drive_config');

db.createCollection('candidate_avatars');
db['candidate_avatars'].createIndex({
  "candidate_id": 1
});

db.createCollection('candidate_history');
db['candidate_history'].createIndex({
  "candidate_id": 1
});

db.createCollection('candidates');
db['candidates'].createIndex({
  "created_at": -1,
  "_id": 1
});
// Clé d'upsert du seed (scripts/startup.py) et lookup de doublon à la création.
// Volontairement NON unique : la base porte des emails dupliqués et non normalisés
// (espaces parasites). Un index unique exige de les nettoyer d'abord — voir docs/AUDIT.md §6.4.
db['candidates'].createIndex({
  "identity.email": 1
});
db['candidates'].createIndex({
  "candidate_id": 1
});
// Recherche full-text (candidatesPage → search) sur le résumé auto-généré du candidat.
db['candidates'].createIndex({
  "identity.description": "text"
});

db.createCollection('drive_folder_config');

db.createCollection('mail_signatures');
db['mail_signatures'].createIndex({
  "user_id": 1
});

db.createCollection('mail_templates');
db['mail_templates'].createIndex({
  "user_id": 1
});
db['mail_templates'].createIndex({
  "user_id": 1,
  "scope": 1
});
db['mail_templates'].createIndex({
  "scope": 1,
  "peda_level": 1
});

db.createCollection('needs_analysis');
// NeedsAnalysisRepository.findByCompanyId / findBySignatureRequestId.
db['needs_analysis'].createIndex({
  "company_infos.id": 1
});
db['needs_analysis'].createIndex({
  "signature_request_id": 1
});

db.createCollection('notifications');
db['notifications'].createIndex({
  "user_id": 1
});
db['notifications'].createIndex({
  "created_at": 1
});

db.createCollection('offers');
db['offers'].createIndex({
  "needs_analysis_id": 1
});
// Utilisé par 8 méthodes d'OfferRepository, dont bookInterviewSlot (réservation de
// créneau, chemin critique) : sans index, chaque appel scanne la collection.
db['offers'].createIndex({
  "matching.candidates.id": 1
});
// Clé d'upsert du seed (scripts/import_jobs.py).
db['offers'].createIndex({
  "company_infos.name": 1,
  "tp_type": 1,
  "localisation": 1
});
