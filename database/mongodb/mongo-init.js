const ROOT = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
db = db.getSiblingDB('admin')
db.auth(ROOT, PASSWORD)

// Crée les collections + index d'un tenant. Rejoué sur les deux bases
// (human_ressources + disciplina_annemasse) afin qu'elles partagent
// exactement le même schéma.
function createSchema(d) {
  d.createCollection('ab_drive_config');

  d.createCollection('candidate_avatars');
  d['candidate_avatars'].createIndex({
    "candidate_id": 1
  });

  d.createCollection('candidate_history');
  d['candidate_history'].createIndex({
    "candidate_id": 1
  });

  d.createCollection('candidates');
  d['candidates'].createIndex({
    "created_at": -1,
    "_id": 1
  });
  // Clé d'upsert du seed (scripts/startup.py) et lookup de doublon à la création.
  // Volontairement NON unique : la base porte des emails dupliqués et non normalisés
  // (espaces parasites). Un index unique exige de les nettoyer d'abord — voir docs/AUDIT.md §6.4.
  d['candidates'].createIndex({
    "identity.email": 1
  });
  d['candidates'].createIndex({
    "candidate_id": 1
  });
  // Recherche full-text (candidatesPage → search) : pondération nom 10× + stemming français.
  d['candidates'].createIndex(
    {
      "identity.description": "text",
      "identity.full_name": "text"
    },
    {
      default_language: "french",
      weights: { "identity.full_name": 10, "identity.description": 1 },
      name: "candidate_text_search"
    }
  );

  d.createCollection('drive_folder_config');

  d.createCollection('kpis');
  // Fusion des ex-tables MySQL commercial_kpi / rh_kpi (#513) : kind discrimine
  // les metrics (site pour commercial, sector pour rh). Clé de bucket unique ;
  // le filtre partiel exclut les user_id null (orphelins hérités) car un index
  // unique Mongo, contrairement à MySQL, rejette les doublons de null.
  d['kpis'].createIndex({
    "kind": 1,
    "user_id": 1,
    "site": 1,
    "sector": 1,
    "year": 1,
    "month": 1,
    "week": 1
  }, { unique: true, partialFilterExpression: { user_id: { $type: "number" } } });

  d.createCollection('mail_signatures');
  d['mail_signatures'].createIndex({
    "user_id": 1
  });

  d.createCollection('commercial_signatures');
  d['commercial_signatures'].createIndex({
    "user_id": 1
  });

  d.createCollection('mail_templates');
  d['mail_templates'].createIndex({
    "user_id": 1
  });
  d['mail_templates'].createIndex({
    "user_id": 1,
    "scope": 1
  });
  d['mail_templates'].createIndex({
    "scope": 1,
    "peda_level": 1
  });

  d.createCollection('needs_analysis');
  // NeedsAnalysisRepository.findByCompanyId / findBySignatureRequestId.
  d['needs_analysis'].createIndex({
    "company_infos.id": 1
  });
  d['needs_analysis'].createIndex({
    "signature_request_id": 1
  });

  d.createCollection('notifications');
  d['notifications'].createIndex({
    "user_id": 1
  });
  d['notifications'].createIndex({
    "created_at": 1
  });

  d.createCollection('offer_history');
  d['offer_history'].createIndex({
    "offer_id": 1
  });

  d.createCollection('offers');
  d['offers'].createIndex({
    "needs_analysis_id": 1
  });
  // Utilisé par 8 méthodes d'OfferRepository, dont bookInterviewSlot (réservation de
  // créneau, chemin critique) : sans index, chaque appel scanne la collection.
  d['offers'].createIndex({
    "matching.candidates.id": 1
  });
  // Clé d'upsert du seed (scripts/import_jobs.py).
  d['offers'].createIndex({
    "company_infos.name": 1,
    "tp_type": 1,
    "localisation": 1
  });
}

createSchema(db.getSiblingDB('human_ressources'));
createSchema(db.getSiblingDB('disciplina_annemasse'));