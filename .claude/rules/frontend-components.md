---
paths:
  - "front/disciplina-front/src/components/**"
  - "front/disciplina-front/src/features/**"
  - "front/disciplina-front/src/pages/**"
---

# Frontend components

- Never use `dangerouslySetInnerHTML` with raw/unsanitized HTML. Always pass through `cleanHtml` from `@/services/sanitizeHtml` first — this is the established pattern across the codebase (`Relance.tsx`, `Calendrier.tsx`, `MailTemplates.tsx`, etc).
- Tailwind v4 for styling; no separate CSS modules unless already present in the file being edited.
- React Compiler is enabled (babel plugin) — don't hand-write `useMemo`/`useCallback` for render-perf reasons alone; only add them where semantics require memoization (e.g. stable identity for an effect dependency).
