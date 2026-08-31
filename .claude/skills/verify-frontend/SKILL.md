---
name: verify-frontend
description: Lint and build the frontend in front/disciplina-front/. Use before considering any frontend change done — CI does not run these checks, so this is the only way they get caught.
---

Run from `front/disciplina-front/`, in order, stopping at the first failure:

1. `npm run lint` — eslint
2. `npm run build` — `tsc -b && vite build`

Report pass/fail for each step. On failure, show the relevant error output, not the full log.

There is no unit test framework configured for the frontend. Playwright e2e tests (`npm run test:e2e`) exist but are not part of this quick-verify flow — run them separately only if the change touches flows they cover.
