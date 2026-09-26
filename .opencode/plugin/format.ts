import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

// Port of .claude/settings.json PostToolUse hook:
// - back/src/*.ts -> prettier --write (run from back/)
// - front/disciplina-front/src/*.{ts,tsx} -> eslint --fix (run from front/disciplina-front/)
export default (async ({ worktree, directory }) => {
  const root = worktree || directory

  const run = (dir: string, bin: string, args: string[]) => {
    const binPath = path.join(root, dir, "node_modules", ".bin", bin)
    if (!existsSync(binPath)) return
    try {
      spawnSync(binPath, args, { cwd: path.join(root, dir), stdio: "ignore" })
    } catch {
      // never break an edit because a formatter failed
    }
  }

  const format = (file: string) => {
    const abs = path.isAbsolute(file) ? file : path.resolve(root, file)
    const rel = path.relative(root, abs)
    if (rel.startsWith("..")) return
    if (/^back[/\\]src[/\\].+\.ts$/.test(rel)) {
      run("back", "prettier", ["--write", rel])
    } else if (/^front[/\\]disciplina-front[/\\]src[/\\].+\.(ts|tsx)$/.test(rel)) {
      run("front/disciplina-front", "eslint", ["--fix", rel])
    }
  }

  return {
    "tool.execute.after": async (_input, output) => {
      const args = (output as { args?: Record<string, unknown> }).args ?? {}
      const file = [args.filePath, args.file_path, args.path].find(
        (v): v is string => typeof v === "string"
      )
      if (file) format(file)
    },
  }
}) satisfies Plugin
