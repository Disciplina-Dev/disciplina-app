import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Pencil, Loader2, ShieldAlert, MapPin } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import UserEditModal, { type ManagedUser } from '@/components/admin/UserEditModal'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  RESPONSABLE: 'Responsable',
  COMMERCIAL: 'Commercial',
  RH: 'RH',
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  RESPONSABLE: 'bg-blue-100 text-blue-700',
  COMMERCIAL: 'bg-emerald-100 text-emerald-700',
  RH: 'bg-amber-100 text-amber-700',
}

function initials(user: ManagedUser): string {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

export default function AdminUsers() {
  const token = useAuthStore((s) => s.token)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ManagedUser | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur de chargement')
      setUsers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white rounded-[20px] p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2>Gestion des utilisateurs</h2>
          <p className="mt-1 text-sm text-gray-500">
            Modifier les profils et secteurs des membres.
          </p>
        </div>
        <Link
          to="/admin/utilisateurs/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus size={16} />
          Créer un utilisateur
        </Link>
      </div>

      <div className="relative mb-5">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-300">
          <Search size={18} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
          className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-gray-100 bg-white text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-blue transition-colors"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-sm text-red-500 mb-4">
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      {!loading && (
        <div className="flex flex-col divide-y divide-gray-100">
          {filtered.map((user) => (
            <div key={user.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue/10 text-blue text-sm font-bold">
                {initials(user)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                {(user.sectors?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {user.sectors!.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px] font-medium"
                      >
                        <MapPin size={10} />
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditing(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-gray-200 text-sm text-gray-600 hover:border-blue hover:text-blue transition-colors"
              >
                <Pencil size={14} />
                Modifier
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">Aucun utilisateur.</p>
          )}
        </div>
      )}

      {editing && (
        <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      </div>
    </div>
  )
}
