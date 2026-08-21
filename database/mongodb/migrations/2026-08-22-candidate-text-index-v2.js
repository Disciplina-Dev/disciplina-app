// Migration v2 de l'index texte candidats :
// - Ajoute `identity.full_name` au full-text (pondération 10×)
// - Passe en `default_language: "french"` (stemming français)
// - Supprime l'ancien index `identity.description_text` s'il existe.
//
// mongo-init.js ne s'applique qu'à une base neuve ; pour une base existante
// exécuter :
//   docker exec <mongo> mongosh -u <user> -p <pass> --authenticationDatabase admin \
//     /path/to/2026-08-22-candidate-text-index-v2.js
// ou copier/coller dans mongosh.

(function () {
  const d = db.getSiblingDB('human_ressources');
  const indexes = d['candidates'].getIndexes();
  const hasOld = indexes.some((idx) => idx.name === 'identity.description_text');
  if (hasOld) {
    print('Dropping old index identity.description_text...');
    d['candidates'].dropIndex('identity.description_text');
  }
  const hasNew = indexes.some((idx) => idx.name === 'candidate_text_search');
  if (hasNew) {
    print('Index candidate_text_search already exists — skipping create.');
    return;
  }
  const res = d['candidates'].createIndex(
    { 'identity.description': 'text', 'identity.full_name': 'text' },
    { default_language: 'french', weights: { 'identity.full_name': 10, 'identity.description': 1 }, name: 'candidate_text_search' },
  );
  print('createIndex result: ' + res);
})();
