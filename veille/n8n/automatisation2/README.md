# automatisation/

Dépose ici tes workflows n8n exportés en JSON (un fichier par workflow).
Ils sont importés **automatiquement au démarrage** par le service `n8n-import`.

## Démarrer (import auto)
```bash
cd veille/n8n
docker compose up -d
```
`n8n-import` tourne d'abord, importe tous les .json, puis n8n démarre.

## Ajouter un workflow après coup
1. Pose le .json ici.
2. `docker compose up -d` (relance l'import) — ou `./import-workflows.sh` à chaud.

## Notes
- **Upsert par id** : réimporter un même workflow le met à jour, ne duplique pas.
- Workflows importés = **inactifs** → active-les dans l'UI (toggle Active).
- Les **credentials** (OAuth) ne sont PAS dans ces JSON → à reconnecter une fois dans l'UI.
- `exemple-hello.json` = exemple fourni (déclencheur manuel → message).
