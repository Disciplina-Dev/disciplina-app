---
paths:
  - "scripts/**"
---

# Deployment scripts

- Any new script run at deployment time (called by `deploy.sh`/`rollback.sh`, or run manually on the prod machine) must be documented in `HOWTODEPLOY.md` — the Notes section for manual steps, the relevant section otherwise. Conversely, keep `deploy.sh`/`rollback.sh` and `HOWTODEPLOY.md` in sync.