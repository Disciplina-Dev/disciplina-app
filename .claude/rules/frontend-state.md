---
paths:
  - "front/disciplina-front/src/store/**"
  - "front/disciplina-front/src/graphql/**"
---

# Frontend state management

- Zustand stores in `src/store/` are plain `create()` stores, no `persist` middleware in use — don't add `persist`/localStorage persistence for auth or tokens without an explicit ask; session/token handling goes through `@/api/auth`, not store persistence.
- `authStore.ts` defines `UserRole`/`Permission` enums used by both frontend guards and mirrored by backend `authGuardRole` checks — if you add a role/permission, it must exist on both sides or authz checks will silently mismatch.
- urql is the GraphQL client; there are 4 separate backend GraphQL endpoints (`companies`, `candidates`, `offers`, `needs-analysis`) — make sure new queries/mutations target the endpoint that actually owns the resolver.
