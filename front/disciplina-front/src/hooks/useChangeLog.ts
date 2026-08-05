import { useCallback, useMemo, useState } from 'react'
import source from '@/content/CHANGELOG.md?raw'
import {
  parseChangelog,
  compareVersions,
  isVersionNewer,
  CHANGELOG_LAST_SEEN_KEY,
  type ChangeLogRelease,
} from '@/lib/changelog'

const allReleases = parseChangelog(source)
const released = allReleases.filter((r) => !r.isUnreleased).sort((a, b) => compareVersions(b.version, a.version))

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_LAST_SEEN_KEY)
  } catch {
    return null
  }
}

function writeLastSeen(version: string): void {
  try {
    localStorage.setItem(CHANGELOG_LAST_SEEN_KEY, version)
  } catch {
    /* stockage indisponible — la version sera re-proposée au prochain chargement */
  }
}

/**
 * Détection des nouveautés depuis la dernière version vue par l'utilisateur.
 *
 * Les versions prises en compte sont uniquement les versions publiées (sections
 * `## [x.y.z]`), pas `[Unreleased]` qui n'est pas encore déployée.
 *
 * Règle d'apparition :
 * - aucun historique (premier usage) : on propose la dernière version publiée ;
 * - sinon, toutes les versions plus récentes que `changelog.lastSeenVersion`.
 */
export function useChangeLog() {
  const [lastSeen, setLastSeen] = useState<string | null>(readLastSeen)

  const latestVersion = released[0]?.version ?? null

  const newReleases = useMemo<ChangeLogRelease[]>(() => {
    if (!latestVersion) return []
    if (!lastSeen) return released.slice(0, 1)
    return released.filter((r) => isVersionNewer(r.version, lastSeen))
  }, [lastSeen, latestVersion])

  const hasNew = newReleases.length > 0

  const markSeen = useCallback(() => {
    if (!latestVersion) return
    setLastSeen(latestVersion)
    writeLastSeen(latestVersion)
  }, [latestVersion])

  return { releases: released, newReleases, hasNew, lastSeen, markSeen }
}