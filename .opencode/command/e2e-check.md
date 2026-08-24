---
description: Point at the relevant E2E.md checklist section for a given flow (e.g. "booking", "matching", "Google OAuth"), and list which automated tests already cover it.
---

The user wants the manual regression checklist and existing automated coverage for this flow: $ARGUMENTS

1. Read `E2E.md`, find the matching subsection under "3. Flux critiques" (e.g. 3.1 Authentification, 3.4 Sourcing SIRET, 3.6 Matching, 3.9 Booking/calendrier — match by keyword, not just exact title).
2. Read "5. Correspondance flux ↔ tests automatisés existants" and extract which Playwright E2E specs and/or vitest component tests already exercise this flow.
3. Report: the manual checklist steps for this flow, the automated test files that already cover pieces of it, and — if the flow was just changed in this session — whether those existing tests still look sufficient or need updating.

Do not run the tests unless explicitly asked; this command is about locating the checklist and coverage, not executing anything.
