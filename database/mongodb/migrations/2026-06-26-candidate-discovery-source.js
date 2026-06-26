// Étend l'enum job_info.discovery_source du validateur $jsonSchema de la
// collection `candidates` avec les nouvelles sources :
// E2CR, TELEVISION_PUB, SALON, RSMA.
//
// mongo-init.js ne s'applique qu'à une base neuve ; pour une base existante
// il faut un collMod. On lit le validateur courant, on patche uniquement
// l'enum, puis on le réapplique (robuste vis-à-vis du reste du validateur).
//
// Usage :
//   docker exec <mongo> mongosh -u <user> -p <pass> --authenticationDatabase admin \
//     /path/to/2026-06-26-candidate-discovery-source.js
// ou copier/coller le contenu dans mongosh.

(function () {
  const d = db.getSiblingDB('human_ressources');
  const info = d.getCollectionInfos({ name: 'candidates' })[0];
  if (!info || !info.options || !info.options.validator) {
    print('Aucun validateur sur candidates — rien à faire.');
    return;
  }
  const validator = info.options.validator;
  const ds = validator.$jsonSchema.properties.job_info.properties.discovery_source;
  ds.enum = [
    'SOCIAL_MEDIA',
    'FRANCE_TRAVAIL',
    'MISSION_LOCALE',
    'WORD_OF_MOUTH',
    'KOANN',
    'E2CR',
    'TELEVISION_PUB',
    'SALON',
    'RSMA',
    'OTHER',
  ];
  const res = d.runCommand({ collMod: 'candidates', validator });
  print('collMod result: ' + JSON.stringify(res));
})();
