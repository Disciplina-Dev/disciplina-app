// Étend le validateur $jsonSchema de la collection `candidates` :
//   - status : ajout de la valeur UNAVAILABLE (candidat indisponible)
//   - identity.has_vehicle (bool) : le candidat possède un véhicule
//   - identity.description (string) : descriptif libre du candidat
//
// mongo-init.js ne s'applique qu'à une base neuve ; pour une base existante
// il faut un collMod. On lit le validateur courant, on patche uniquement les
// éléments concernés, puis on le réapplique.
//
// Usage :
//   docker exec <mongo> mongosh -u <user> -p <pass> --authenticationDatabase admin \
//     /path/to/2026-07-01-candidate-unavailable-status.js
// ou copier/coller le contenu dans mongosh.

(function () {
  const d = db.getSiblingDB('human_ressources');
  const info = d.getCollectionInfos({ name: 'candidates' })[0];
  if (!info || !info.options || !info.options.validator) {
    print('Aucun validateur sur candidates — rien à faire.');
    return;
  }
  const validator = info.options.validator;
  const props = validator.$jsonSchema.properties;

  props.status.enum = [
    'SEEKING',
    'NOT_SEEKING',
    'UNAVAILABLE',
    'CANCELLED',
    'MATCHED',
    'CONTRACT',
    'IMMERSING',
    'BANNED',
  ];
  props.identity.properties.has_vehicle = { bsonType: 'bool' };
  props.identity.properties.description = { bsonType: 'string' };

  const res = d.runCommand({ collMod: 'candidates', validator });
  print('collMod result: ' + JSON.stringify(res));
})();
