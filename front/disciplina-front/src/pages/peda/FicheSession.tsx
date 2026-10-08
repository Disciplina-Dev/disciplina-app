import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconEdit,
  IconLoader,
  IconPlus,
  IconSearch,
  IconTraining,
  IconTrash,
  IconUnlink,
  IconUser,
} from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import SessionFormModal from '@/components/peda/SessionFormModal'
import {
  assignAlternantToSession,
  deleteSession,
  fetchSession,
  fetchSessionAlternants,
  removeAlternantFromSession,
} from '@/api/sessions'
import { fetchAlternants } from '@/api/alternants'
import type { Alternant } from '@/types/alternant'
import type { Session } from '@/types/session'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export default function FicheSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [members, setMembers] = useState<Alternant[]>([])
  const [allAlternants, setAllAlternants] = useState<Alternant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([fetchSession(id), fetchSessionAlternants(id), fetchAlternants()]).then(
      ([s, list, all]) => {
        if (!alive) return
        if (!s) {
          setError('Session introuvable.')
          setLoading(false)
          return
        }
        setSession(s)
        setMembers(list)
        setAllAlternants(all)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [id])

  const assignable = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return allAlternants
      .filter((a) => !(a.sessionId && a.sessionId === id))
      .filter((a) =>
        q ? `${a.firstName} ${a.lastName} ${a.session} ${a.company?.name ?? ''}`.toLowerCase().includes(q) : true,
      )
  }, [allAlternants, pickerSearch, id])

  async function handleAssign(alternantId: string) {
    if (!id) return
    try {
      const updated = await assignAlternantToSession(id, alternantId)
      if (updated) setSession(updated)
      if (id) setMembers(await fetchSessionAlternants(id))
      setAllAlternants(await fetchAlternants())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignation impossible')
    }
  }

  async function handleUnassign(alternantId: string) {
    if (!id) return
    try {
      const updated = await removeAlternantFromSession(id, alternantId)
      if (updated) setSession(updated)
      if (id) setMembers(await fetchSessionAlternants(id))
      setAllAlternants(await fetchAlternants())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retrait impossible')
    }
  }

  async function handleDelete() {
    if (!id) return
    setActionLoading(true)
    try {
      await deleteSession(id)
      navigate('/peda/sessions')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible')
      setConfirmDelete(false)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
        <IconLoader width={28} height={28} className="animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <Button variant="ghost" size="sm" leftIcon={<IconArrowLeft width={16} height={16} />} onClick={() => navigate('/peda/sessions')}>
          Retour aux sessions
        </Button>
        <p className="mt-6 text-[var(--ds-danger)]">{error ?? 'Session introuvable.'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" leftIcon={<IconArrowLeft width={16} height={16} />} onClick={() => navigate('/peda/sessions')}>
            Retour
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700/10 text-teal-700">
            <IconTraining width={24} height={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--ds-text)]">{session.nom}</h1>
            <p className="mt-0.5 text-sm text-[var(--ds-text-subtle)]">
              {session.filiere ?? 'Filière non renseignée'} · {members.length} alternant{members.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<IconEdit width={14} height={14} />} onClick={() => setShowEdit(true)}>
            Modifier
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={16} height={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Informations" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Filière</dt>
                <dd className="font-semibold text-[var(--ds-text)]">{session.filiere ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Jour de cours</dt>
                <dd className="font-semibold text-[var(--ds-text)]">{session.jourCours ?? '-'}</dd>
              </div>
              <div className="flex items-center gap-2 text-[var(--ds-text-muted)]">
                <IconCalendar width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                <dd>
                  Du {formatDate(session.dateDebut)} au {formatDate(session.dateFin)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Gestion" />
            <div className="flex flex-col gap-2">
              {confirmDelete ? (
                <div className="rounded-xl border border-[var(--ds-danger)]/30 p-3">
                  <p className="text-[13px] text-[var(--ds-text-muted)]">
                    Supprimer cette session ? Les alternants gardent leur libellé mais seront désassignés du groupe.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" onClick={handleDelete} isLoading={actionLoading}>
                      Confirmer
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" size="sm" leftIcon={<IconTrash width={14} height={14} />} onClick={() => setConfirmDelete(true)}>
                  Supprimer
                </Button>
              )}
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader
            title={`Alternants (${members.length})`}
            description="Assignez des alternants à cette session ou retirez-les du groupe."
            actions={
              <Button variant="secondary" size="sm" leftIcon={<IconPlus width={14} height={14} />} onClick={() => setPickerOpen((v) => !v)}>
                Assigner
              </Button>
            }
          />

          {pickerOpen && (
            <div className="mb-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                  <IconSearch width={16} height={16} />
                </span>
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Rechercher un alternant…"
                  aria-label="Rechercher un alternant à assigner"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--ds-accent)]"
                />
              </div>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {assignable.length === 0 && (
                  <li className="px-3 py-2 text-[13px] text-[var(--ds-text-subtle)]">
                    Aucun alternant à assigner.
                  </li>
                )}
                {assignable.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--ds-surface)] px-3 py-1.5 text-sm ring-1 ring-inset ring-[var(--ds-border)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--ds-text)]">{a.fullName}</span>
                      <span className="block truncate text-[12px] text-[var(--ds-text-subtle)]">{a.session}</span>
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => handleAssign(a.id)}>
                      Assigner
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] py-12 text-[var(--ds-text-subtle)]">
              <IconUser width={48} height={48} className="mb-4" />
              <p className="text-lg font-medium text-[var(--ds-text)]">Aucun alternant dans cette session</p>
              <p className="text-sm">Assignez des alternants avec le bouton « Assigner ».</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {members.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3"
                >
                  <Link to={`/peda/alternants/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700/10 text-sm font-bold text-teal-700">
                      {(a.firstName[0] ?? '?').toUpperCase()}{(a.lastName[0] ?? '').toUpperCase()}
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--ds-text)]">{a.fullName}</span>
                      <span className="block truncate text-[12px] text-[var(--ds-text-subtle)]">
                        {a.company?.name ?? 'Sans entreprise'}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleUnassign(a.id)}
                    title={`Retirer ${a.fullName} de la session`}
                    className="shrink-0 rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
                  >
                    <IconUnlink width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {showEdit && (
        <SessionFormModal
          initial={session}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setSession(updated)
            setShowEdit(false)
          }}
        />
      )}
    </div>
  )
}
