import type { UserRole } from '@/store/authStore'

const API_BASE = import.meta.env.VITE_API_URL

export interface DirectoryEntry {
  id: number
  firstName: string
  lastName: string
  role: UserRole
}

export async function fetchStaffDirectory(token: string): Promise<DirectoryEntry[]> {
  const res = await fetch(`${API_BASE}/api/auth/directory`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Directory fetch failed (${res.status})`)
  return (await res.json()) as DirectoryEntry[]
}
