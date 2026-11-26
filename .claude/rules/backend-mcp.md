---
paths:
  - "back/src/mcp/**"
---

# Backend MCP tools (RGPD)

Full rulebook: `back/CONVENTION.md` § "MCP tools (RGPD)", `MCP_RGPD_AUDIT.md`, `rgpd/registre-mcp.md`.

- Register tools through `readTool` (scope, quota, `mcp_audit_log`) — never `server.registerTool` directly. Read-only only.
- Declare exposed fields explicitly (no object spread). No Art. 9 data, no `emergency_contact`, no SSN (masked), no email/phone/tutor for péda.
- Candidate data → `candidateExposure.ts` (`ai_processing` consent). Péda data → `pedaExposure.ts` (consent via `candidate_id`, « Prénom N. », counts masked below `PEDA_MIN_GROUP`, no subtraction leak).
- Paginate (`MAX_PAGE_SIZE` = 50); read-only service variants, no side effects.
- New free-text notification types → `redactPersonalNotification` (`tools/misc.ts`); new subject ids → `SUBJECT_KEYS` (`auditStore.ts`).
- Every new tool needs a test asserting excluded fields are absent; update `rgpd/registre-mcp.md` if data categories change.
- `zod` is allowed here only (MCP SDK requirement).
