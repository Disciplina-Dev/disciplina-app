---
description: Run backend/frontend verify + security/convention/performance/dependency review agents in parallel, aggregate a merge-readiness punch list.
---

Assess whether the current branch is ready to merge into `main`. Do the following:

1. Run the `verify-backend` skill and the `verify-frontend` skill (lint + build + backend tests, lint + build for front). Note pass/fail for each step.
2. In parallel, launch these 4 agents against `git diff main...HEAD`:
   - `security-reviewer`
   - `convention-checker`
   - `performance-reviewer`
   - `dependency-reviewer` (skip this one if `back/package.json` and `front/disciplina-front/package.json` are unchanged vs `main`)
3. Wait for all agents to finish, then produce a single punch list:
   - **Blockers** — failing lint/build/tests, CONFIRMED findings from any agent.
   - **Should fix** — PLAUSIBLE findings worth a second look.
   - **Ready** — what already passes.

Keep the final summary short: a bullet list, not a report. Don't re-run the agents' underlying checks yourself — trust their `ReportFindings` output, but sanity-check any CONFIRMED finding against the actual file before listing it as a blocker.
