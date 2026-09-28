import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconEdit, IconLoader, IconMapPin, IconSearch, IconShieldAlert, IconTrash, IconUserPlus } from '@/components/ui/icons'
import { apiJson } from '@/api/httpClient'
import UserEditModal, { type ManagedUser } from '@/components/admin/UserEditModal'
import DeleteUserModal from '@/components/admin/DeleteUserModal'
import { useAuthStore } from '@/store/authStore'

const ROLE_LABELS: Record<string, string> = {
  AD: 'Admin',
  GESTION: 'Gestion',
  COMMERCIAL: 'Commercial',
  RH: 'RH',
}

const ROLE_BADGE: Record<string, string> = {
  AD: 'bg-purple-100 text-purple-700',
  GESTION: 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]',
  COMMERCIAL: 'bg-emerald-100 text-emerald-700',
  RH: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]',
}

const PERMISSION_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employé',
  RESPONSABLE: 'Responsable',
  ADMIN: 'Admin',
}

const PERMISSION_BADGE: Record<string, string> = {
  EMPLOYEE: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]',
  RESPONSABLE: 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]',
  ADMIN: 'bg-purple-100 text-purple-700',
}

function initials(user: ManagedUser): string {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState<ManagedUser | null>(null)
  const me = useAuthStore((s) => s.user)
  const isAdmin = me?.permission === 'ADMIN'

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<ManagedUser[]>('/api/auth/users')
      setUsers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email} ${ROLE_LABELS[u.role] ?? u.role}`
        .toLowerCase()
        .includes(q),
    )
  }, [users, search])

  const handleSaved = (updated: ManagedUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setEditing(null)
  }

  const handleDeleted = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setDeleting(null)
  }

  // Remplaçants proposés : actifs, même rôle que le compte supprimé.
  const replacements = useMemo(
    () => (deleting ? users.filter((u) => u.role === deleting.role && u.id !== deleting.id) : []),
    [users, deleting],
  )

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-[var(--ds-surface)] rounded-[20px] p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2>Gestion des utilisateurs</h2>
          <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">
            Modifier les profils et secteurs des membres.
          </p>
        </div>
        <Link
          to="/admin/utilisateurs/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <IconUserPlus width={16} height={16} />
          Créer un utilisateur
        </Link>
      </div>

      <div className="relative mb-5">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
          <IconSearch width={18} height={18} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
          className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none focus:border-blue transition-colors"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--ds-text-subtle)] py-6 justify-center">
          <IconLoader width={16} height={16} className="animate-spin" /> Chargement…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--ds-danger)] mb-4">
          <IconShieldAlert width={16} height={16} /> {error}
        </div>
      )}

      {!loading && (
        <div className="flex flex-col divide-y divide-[var(--ds-border)]">
          {filtered.map((user) => (
            <div key={user.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue/10 text-blue text-sm font-bold">
                {initials(user)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--ds-text)] truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE[user.role] ?? 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]'}`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  {user.permission && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${PERMISSION_BADGE[user.permission] ?? 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]'}`}
                    >
                      {PERMISSION_LABELS[user.permission] ?? user.permission}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--ds-text-subtle)] truncate">{user.email}</p>
                {(user.sectors?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {user.sectors!.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] text-[11px] font-medium"
                      >
                        <IconMapPin width={10} height={10} />
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditing(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--ds-border)] text-sm text-[var(--ds-text-muted)] hover:border-blue hover:text-blue transition-colors"
              >
                <IconEdit width={14} height={14} />
                Modifier
              </button>

              {isAdmin && me?.id !== undefined && String(me.id) !== String(user.id) && (
                <button
                  type="button"
                  onClick={() => setDeleting(user)}
                  aria-label={`Supprimer ${user.firstName} ${user.lastName}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--ds-border)] text-sm text-[var(--ds-text-muted)] hover:border-danger hover:text-[var(--ds-danger)] transition-colors"
                >
                  <IconTrash width={14} height={14} />
                  Supprimer
                </button>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-sm text-[var(--ds-text-subtle)] py-6 text-center">Aucun utilisateur.</p>
          )}
        </div>
      )}

      {editing && (
        <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteUserModal
          user={deleting}
          replacements={replacements}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
      </div>
    </div>
  )
}
