# AGENTS.md

Project instructions for opencode (and any agent reading this file) live in [`CLAUDE.md`](CLAUDE.md) — read it first. Path-scoped rules are in `.claude/rules/*.md` (opencode loads them via `opencode.json`, **without** the `paths:` filter, so apply each only to the paths it names).

Differences vs Claude Code:
- No Stop hooks (`test-gate`, `test-coverage-check`, `docs-freshness-check`) — run `verify-backend` / `verify-frontend` (`.claude/skills/`) and check docs by hand before finishing.
- Formatting hook is ported in `.opencode/plugin/format.ts`.
- Subagents in `.opencode/agent/` mirror `.claude/agents/`: edit both together.
