---
description: Scaffold a new MySQL column/table, editing both required places (mysql-init.sql + migrations.ts REQUIRED_COLUMNS) so the backfill-vs-fresh-volume split isn't forgotten.
---

Add the following MySQL schema change: $ARGUMENTS

Per root `CLAUDE.md`: new MySQL columns must be added in **two places**, or existing DB volumes never get the column:

1. `database/mysql/mysql-init.sql` — the source of truth, only applied on a fresh volume.
2. `back/src/db/mysql/migrations.ts` — `REQUIRED_COLUMNS`, which backfills existing volumes on startup.

Steps:
1. Read both files first to match the existing style (column naming — camelCase converted at repository per `.claude/rules/*`, existing `ALTER TABLE`/`REQUIRED_COLUMNS` entry format).
2. Add the column/table to `mysql-init.sql` in the right table definition.
3. Add the matching entry to `REQUIRED_COLUMNS` in `migrations.ts` with the same type/default/nullability.
4. If the column needs an index for a query added elsewhere in this session, add it in `mysql-init.sql` too (see `performance-reviewer` conventions).
5. Report back which two files were touched and the exact lines added, so the user can sanity-check both are consistent.
