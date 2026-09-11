// Migration : création de la base secondaire `disciplina_annemasse` (multi-tenant
// — site Annemasse) sur une instance MongoDB EXISTANTE.
//
// mongo-init.js ne s'applique qu'à une nouvelle instance (volume vierge). Pour une
// instance déjà en service, ce script clone le schéma de `human_ressources` :
// mêmes 13 collections, mêmes index (dont le full-text candidats), sans aucune
// donnée (les tenants partagent le schéma, pas les données).
//
// Ré-exécutable : createCollection/indexCreateIfMissing sont idempotents.
//
// Usage :
//   docker exec <mongo> mongosh -u <user> -p <pass> --authenticationDatabase admin \
//     /path/to/2026-09-10-annemasse-schema.js
// ou copier/coller le contenu dans mongosh.

(function () {
  const SOURCE = 'human_ressources';
  const TARGET = 'disciplina_annemasse';

  // Clé d'upsert du seed (scripts/startup.py) et lookup de doublon à la création.
  // Volontairement NON unique : la base porte des emails dupliqués et non normalisés
  // (espaces parasites). Un index unique exige de les nettoyer d'abord — voir docs/AUDIT.md §6.4.
  // Fusion des ex-tables MySQL commercial_kpi / rh_kpi (#513) : kind discrimine
  // les metrics (site pour commercial, sector pour rh). Clé de bucket unique ;
  // le filtre partiel exclut les user_id null (orphelins hérités) car un index
  // unique Mongo, contrairement à MySQL, rejette les doublons de null.
  const ARCHITECTURE = [
    { name: 'ab_drive_config', indexes: [] },
    { name: 'candidate_avatars', indexes: [{ key: { candidate_id: 1 } }] },
    { name: 'candidate_history', indexes: [{ key: { candidate_id: 1 } }] },
    {
      name: 'candidates',
      indexes: [
        { key: { created_at: -1, _id: 1 } },
        { key: { 'identity.email': 1 } },
        { key: { candidate_id: 1 } },
        {
          key: { 'identity.description': 'text', 'identity.full_name': 'text' },
          options: {
            default_language: 'french',
            weights: { 'identity.full_name': 10, 'identity.description': 1 },
            name: 'candidate_text_search',
          },
        },
      ],
    },
    { name: 'drive_folder_config', indexes: [] },
    {
      name: 'kpis',
      indexes: [
        {
          key: { kind: 1, user_id: 1, site: 1, sector: 1, year: 1, month: 1, week: 1 },
          options: { unique: true, partialFilterExpression: { user_id: { $type: 'number' } } },
        },
      ],
    },
    { name: 'mail_signatures', indexes: [{ key: { user_id: 1 } }] },
    { name: 'commercial_signatures', indexes: [{ key: { user_id: 1 } }] },
    {
      name: 'mail_templates',
      indexes: [
        { key: { user_id: 1 } },
        { key: { user_id: 1, scope: 1 } },
        { key: { scope: 1, peda_level: 1 } },
      ],
    },
    {
      name: 'needs_analysis',
      indexes: [
        { key: { 'company_infos.id': 1 } },
        { key: { signature_request_id: 1 } },
      ],
    },
    {
      name: 'notifications',
      indexes: [{ key: { user_id: 1 } }, { key: { created_at: 1 } }],
    },
    { name: 'offer_history', indexes: [{ key: { offer_id: 1 } }] },
    {
      name: 'offers',
      indexes: [
        { key: { needs_analysis_id: 1 } },
        { key: { 'matching.candidates.id': 1 } },
        { key: { 'company_infos.name': 1, tp_type: 1, localisation: 1 } },
      ],
    },
  ];

  const source = db.getSiblingDB(SOURCE);
  const target = db.getSiblingDB(TARGET);

  // Vérifie que le schéma source est bien ce qu'on clone (garde-fou : ne pas
  // dériver de `human_ressources` si l'architecture cible diverge).
  const sourceCollections = source.getCollectionNames().sort();
  const expected = ARCHITECTURE.map((c) => c.name).sort();
  const missing = expected.filter((n) => !sourceCollections.includes(n));
  if (missing.length > 0) {
    print(`[SKIP] collections absentes de ${SOURCE} : ${missing.join(', ')} — rien à faire.`);
    return;
  }

  for (const c of ARCHITECTURE) {
    const targetNames = target.getCollectionNames();
    if (!targetNames.includes(c.name)) {
      target.createCollection(c.name);
      print(`created collection ${TARGET}.${c.name}`);
    }

    const existing = target.getCollection(c.name).getIndexes().map((i) => i.name);
    for (const idx of c.indexes) {
      const idxName = (idx.options && idx.options.name) || Object.keys(idx.key).join('_');
      if (existing.includes(idxName)) {
        print(`index ${TARGET}.${c.name}.${idxName} already exists — skipping`);
        continue;
      }
      const res = target.getCollection(c.name).createIndex(idx.key, idx.options || {});
      print(`index ${TARGET}.${c.name} created: ${res}`);
    }
  }

  const finalCollections = target.getCollectionNames();
  const finalTextIndex = target
    .getCollection('candidates')
    .getIndexes()
    .some((i) => i.name === 'candidate_text_search');
  print('== Résumé ==');
  print(`collections: ${finalCollections.length} (${finalCollections.sort().join(', ')})`);
  print(`full-text candidates présent: ${finalTextIndex}`);
})();