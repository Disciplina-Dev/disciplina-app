export type ChangeLogCategory = 'Added' | 'Changed' | 'Deprecated' | 'Fixed' | 'Security'

export interface ChangeLogRelease {
  /** Numéro de version (ex. "1.14.0") sans préfixe `v`. */
  version: string
  /** Date au format AAAA-MM-JJ, ou null pour `[Unreleased]`. */
  date: string | null
  isUnreleased: boolean
  /** Éléments de chaque catégorie, dans l'ordre du fichier. */
  changes: Partial<Record<ChangeLogCategory, string[]>>
}

export const CHANGELOG_LAST_SEEN_KEY = 'changelog.lastSeenVersion'

const CATEGORY_ORDER: ChangeLogCategory[] = ['Added', 'Changed', 'Deprecated', 'Fixed', 'Security']

/**
 * Parser minimal du format CHANGELOG.md (inspiré de Keep a Changelog).
 * Extrait les sections `## [version]` et leurs listes `- ...` par catégorie `###`.
 * Tout texte hors sections (en-tête, conventions…) est ignoré.
 */
export function parseChangelog(markdown: string): ChangeLogRelease[] {
  const releases: ChangeLogRelease[] = []
  let current: ChangeLogRelease | null = null
  let currentCategory: ChangeLogCategory | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const header = line.match(/^##\s+\[?(.+?)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/)
    if (header) {
      const rawVersion = header[1]?.trim() ?? ''
      const isUnreleased = /^unreleased$/i.test(rawVersion)
      const isVersion = /^v?\d+(?:\.\d+){0,2}$/i.test(rawVersion)
      // Ignore les titres non-versionnés de l'en-tête (ex. `## Conventions`).
      if (!isUnreleased && !isVersion) {
        current = null
        currentCategory = null
        continue
      }
      current = {
        version: rawVersion.replace(/^v/i, ''),
        date: header[2] ?? null,
        isUnreleased,
        changes: {},
      }
      currentCategory = null
      releases.push(current)
      continue
    }

    if (!current) continue

    const category = line.match(/^###\s+(.+?)\s*$/)
    if (category) {
      const name = category[1]?.trim() as ChangeLogCategory
      currentCategory = CATEGORY_ORDER.includes(name) ? name : null
      continue
    }

    if (!currentCategory) continue

    const item = line.match(/^\s*[-*]\s+(.+?)\s*$/)
    if (item) {
      const text = item[1]?.trim()
      if (text) (current.changes[currentCategory] ??= []).push(text)
    }
  }

  return releases
}

function parseVersion(version: string): number[] | null {
  const match = /^v?\d+(?:\.\d+){0,2}$/.exec(version.trim())
  if (!match) return null
  return match[0].replace(/^v/i, '').split('.').map(Number)
}

/** Compare deux versions sémantiques. Retourne 1, -1 ou 0 (0 si non comparable). */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return 0
  const length = Math.max(va.length, vb.length)
  for (let i = 0; i < length; i++) {
    const da = va[i] ?? 0
    const db = vb[i] ?? 0
    if (da !== db) return da > db ? 1 : -1
  }
  return 0
}

/** Retourne true si `candidate` est strictement plus récent que `reference`. */
export function isVersionNewer(candidate: string, reference: string): boolean {
  return compareVersions(candidate, reference) > 0
}