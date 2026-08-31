---
paths:
  - "back/src/graphql/**"
---

# Backend GraphQL resolvers

- Every mutation/query resolver that touches non-public data must start with `authGuardRole(context.user, Permission.<X>, [JobRole.<Y>])` — check sibling resolvers in the same file for the correct permission/role before adding a new one. Missing this check is the most common way to introduce an authz hole here.
- `console.*` is banned — use the `logger` singleton from `external/logger/` (see root CLAUDE.md).
- `zod` is banned in this layer (root CLAUDE.md) — validate inputs with existing hand-rolled guards/types, not a new schema library.
- Resolvers convert MongoDB snake_case fields to camelCase at this layer; don't "fix" incoming snake_case fields from Mongo services, that's intentional.
