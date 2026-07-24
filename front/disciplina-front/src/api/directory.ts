import type { UserRole, Permission } from '@/store/authStore'
import { apiJson } from '@/api/httpClient'

export interface DirectoryEntry {
  id: number
  firstName: string
  lastName: string
  role: UserRole
  permission: Permission
}

export async function fetchStaffDirectory(): Promise<DirectoryEntry[]> {
  return apiJson<DirectoryEntry[]>('/api/auth/directory')
}
