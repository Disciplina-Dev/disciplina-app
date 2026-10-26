import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconLoader,
  IconTraining,
  IconUser,
} from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import InputField from '@/components/ui/InputField'
import { fetchSession, fetchSessionAlternants, renameSession } from '@/api/sessions'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleRename() {
    if (!id || !draftName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await renameSession(id, draftName)
      if (updated) setSession(updated)
      setEditing(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Renommage impossible')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([fetchSession(id), fetchSessionAlternants(id)]).then(
      ([s, list]) => {
        if (!alive) return
        if (!s) {
          setError('Session introuvable.')
          setLoading(false)
          return
        }
        setSession(s)
        setMembers(list)
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
            {editing ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleRename()
                }}
              >
                <InputField
                  id="session-name"
                  label="Nom de la promotion"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={saving || !draftName.trim()}>
                  Enregistrer
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--ds-text)]">{session.nom}</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftName(session.nom)
                    setEditing(true)
                  }}
                >
                  Renommer
                </Button>
              </div>
            )}
            <p className="mt-0.5 text-sm text-[var(--ds-text-subtle)]">
              {session.filiere ?? 'Filière non renseignée'} · {members.length} alternant{members.length > 1 ? 's' : ''}
            </p>
          </div>
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
        </div>

        <Card className="h-fit">
          <CardHeader
            title={`Alternants (${members.length})`}
            description="Alternants dont le dossier Filiz appartient à cette classe."
          />

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] py-12 text-[var(--ds-text-subtle)]">
              <IconUser width={48} height={48} className="mb-4" />
              <p className="text-lg font-medium text-[var(--ds-text)]">Aucun alternant dans cette session</p>
              <p className="text-sm">Ils apparaissent dès qu'un dossier Filiz est rattaché à cette classe.</p>
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
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
