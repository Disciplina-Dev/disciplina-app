---
description: Scaffold a new read-only MCP tool with RGPD guards (readTool, consent/masking helpers, audit subject, exclusion test, registre update).
argument-hint: <tool name and what it exposes>
---

Add the following read-only MCP tool: $ARGUMENTS

Rulebook: `back/CONVENTION.md` § "MCP tools (RGPD)", `.claude/rules/backend-mcp.md`, `MCP_RGPD_AUDIT.md`.

Steps:
1. Read a sibling tool file in `back/src/mcp/tools/` (`peda.ts` for péda, `candidates.ts` for candidates) and the matching exposure helper (`pedaExposure.ts` / `candidateExposure.ts`) to match style.
2. Register the tool with `readTool(server, name, description, inputSchema, scope, handler)` from `mcp/tool.ts` — never `server.registerTool`. Pick the scope with `mcpToolScope(Permission.X, [JobRole.Y])` (`mcp/rbac.ts`). `zod` is allowed in `src/mcp/` only.
3. Use existing read-only services (no side effects). Return explicit DTO fields only; route data through the consent/masking helper (`ai_processing` filter; péda: `candidate_id` consent, « Prénom N. », `PEDA_MIN_GROUP`). No Art. 9 data, no `emergency_contact`, no email/phone/tutor.
4. Paginate lists (`MAX_PAGE_SIZE` = 50, `pageOf`). If the tool takes a new subject id, add it to `SUBJECT_KEYS` in `mcp/auditStore.ts`.
5. Add a component test in `back/src/mcp/__tests__/` (pattern: `peda.test.ts` — real app, `POST /api/mcp`, mock only `src/external/*`) asserting excluded fields are absent and unconsented records are hidden.
6. Update `rgpd/registre-mcp.md` if data categories change, and the tool count in `MCP_RGPD_AUDIT.md` / `back/README.md` / `README.md`.
7. Report the files touched; suggest running `verify-backend`.
