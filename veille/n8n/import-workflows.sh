#!/usr/bin/env bash
# Importe (upsert) tous les workflows JSON de ./automatisation dans n8n.
# Un même workflow (même id) est mis à jour, pas dupliqué.
set -e
docker compose exec n8n n8n import:workflow --separate --input=/automatisation
echo "Import terminé. Les workflows importés sont INACTIFS par défaut → active-les dans l'UI."
