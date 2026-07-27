// Ajoute un index texte sur `identity.description` pour permettre la
// recherche `$text` (candidatesPage → search) en complément du `$regex`
// existant, à la place d'un `$regex` seul sur `identity.full_name`.
//
// mongo-init.js ne s'applique qu'à une base neuve ; pour une base existante
// il faut créer l'index manuellement.
//
// Usage :
//   docker exec <mongo> mongosh -u <user> -p <pass> --authenticationDatabase admin \
//     /path/to/2026-07-24-candidate-description-text-index.js
// ou copier/coller le contenu dans mongosh.

(function () {
  const d = db.getSiblingDB('human_ressources');
  const res = d['candidates'].createIndex({ 'identity.description': 'text' });
  print('createIndex result: ' + res);
})();
