---
description: Run only the convention-checker agent against the current diff (quick check, no full pr-ready pass).
---

Launch the `convention-checker` agent against `git diff main...HEAD` and report its findings directly to the user — don't run the other `pr-ready` steps (lint/build/tests, security, performance, dependency review).
