import { useEffect, useState } from 'react'
import { useAuthStore, type UserRole, type Permission } from '@/store/authStore'
import { fetchStaffDirectory, type DirectoryEntry } from '@/api/directory'

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: UserRole
  permission: Permission
  color: string
  initials: string
}

const PALETTE = ['#6366F1', '#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B']

function toStaffMember(entry: DirectoryEntry): StaffMember {
  return {
    id: String(entry.id),
    firstName: entry.firstName,
    lastName: entry.lastName,
    role: entry.role,
    permission: entry.permission,
    color: PALETTE[entry.id % PALETTE.length],
    initials: entry.firstName.trim().charAt(0).toUpperCase() || '-',
  }
}

function indexById(entries: DirectoryEntry[]): Record<string, StaffMember> {
  const map: Record<string, StaffMember> = {}
  for (const entry of entries) map[String(entry.id)] = toStaffMember(entry)
  return map
}

// Un seul appel réseau partagé par tous les composants montés.
let pending: Promise<Record<string, StaffMember>> | null = null

function loadDirectory(token: string): Promise<Record<string, StaffMember>> {
  if (!pending) pending = fetchStaffDirectory(token).then(indexById)
  return pending
}

export function resetStaffDirectoryCache(): void {
  pending = null
}

export function useStaffDirectory(): { directory: Record<string, StaffMember>; loading: boolean } {
  const token = useAuthStore((s) => s.token)
  const [directory, setDirectory] = useState<Record<string, StaffMember>>({})
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadDirectory(token)
      .then((map) => { if (!cancelled) setDirectory(map) })
      .catch(() => { pending = null })
      .finally(() => { if (!cancelled) setSettled(true) })
    return () => { cancelled = true }
  }, [token])

  return { directory, loading: Boolean(token) && !settled }
}
