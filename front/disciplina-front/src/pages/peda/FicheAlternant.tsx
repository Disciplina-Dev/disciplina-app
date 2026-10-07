import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconClose,
  IconCompany,
  IconEdit,
  IconFile,
  IconLink,
  IconLoader,
  IconMail,
  IconPhone,
  IconPlus,
  IconTrash,
  IconUnlink,
  IconUser,
} from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import InputField from '@/components/ui/InputField'
import AlternantCreateModal from '@/components/peda/AlternantCreateModal'
import AlternantCompanyModal from '@/components/peda/AlternantCompanyModal'
import {
  changeAlternantCompany,
  completeSequence,
  createSequence,
  deleteAlternant,
  deleteSequence,
  fetchAlternant,
  fetchAlternants,
  fetchSequences,
  linkAlternant,
  markSequence,
  removeAlternantCompany,
  unlinkAlternant,
  updateAlternant,
  updateSequenceContacts,
  type CompanyForm,
} from '@/api/alternants'
import { fetchSessions } from '@/api/sessions'
import type { Alternant, AlternantSequence, SequenceContacts } from '@/types/alternant'
import type { Session } from '@/types/session'

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function daysLabel(prevueLe: string, status: string, realiseeLe: string | null): string {
  if (status === 'done') return realiseeLe ? `Réalisée le ${formatDate(realiseeLe)}` : 'Réalisée'
  if (status === 'not_done') return 'Non réalisée'
  const diff = Math.ceil((new Date(prevueLe).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (diff > 1) return `Dans ${diff} jours`
  if (diff === 1) return 'Demain'
  if (diff === 0) return "Aujourd’hui"
  return `En retard de ${-diff} jour${-diff > 1 ? 's' : ''}`
}

function ContactCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <label
      className={[
        'inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
        checked
          ? 'bg-[var(--ds-success)]/15 text-[var(--ds-success)] ring-1 ring-inset ring-[var(--ds-success)]/30'
          : 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]',
        disabled ? 'cursor-not-allowed opacity-55' : '',
      ].join(' ')}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 accent-teal-700" />
      {label}
    </label>
  )
}

const CONTACT_LABELS: { key: keyof SequenceContacts; label: string }[] = [
  { key: 'mentor', label: 'Maître d’apprentissage' },
  { key: 'alternant', label: 'Alternant' },
  { key: 'formateur', label: 'Formateur' },
]

export default function FicheAlternant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [alternant, setAlternant] = useState<Alternant | null>(null)
  const [sequences, setSequences] = useState<AlternantSequence[]>([])
  const [linkedNames, setLinkedNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEdit, setShowEdit] = useState(false)
  const [showCompany, setShowCompany] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'removeCompany' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [newSaDate, setNewSaDate] = useState('')
  const [saLoading, setSaLoading] = useState(false)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const [allAlternants, setAllAlternants] = useState<Alternant[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionSaving, setSessionSaving] = useState(false)
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(null)
  const [completionDate, setCompletionDate] = useState('')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([fetchAlternant(id), fetchSequences(id), fetchAlternants(), fetchSessions()]).then(
      ([a, seqs, all, sess]) => {
        if (!alive) return
        if (!a) {
          setError('Alternant introuvable.')
          setLoading(false)
          return
        }
        setAlternant(a)
        setSequences(seqs)
        const names: Record<string, string> = {}
        for (const other of all) names[other.id] = other.fullName
        setLinkedNames(names)
        setAllAlternants(all)
        setSessions(sess)
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

  const linkedOthers = useMemo(
    () => (alternant?.linkedAlternantIds ?? []).map((lid) => ({ id: lid, name: linkedNames[lid] ?? 'Alternant' })),
    [alternant, linkedNames],
  )

  const linkable = useMemo(
    () =>
      allAlternants.filter(
        (a) => a.id !== id && !(alternant?.linkedAlternantIds ?? []).includes(a.id),
      ),
    [allAlternants, id, alternant],
  )

  const sequenceCounts = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const counts = { done: 0, ongoing: 0, late: 0, upcoming: 0 }
    for (const seq of sequences) {
      if (seq.status === 'done') {
        counts.done += 1
        continue
      }
      const prevue = new Date(seq.prevueLe)
      prevue.setHours(0, 0, 0, 0)
      const diffDays = Math.round((prevue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000))
      if (diffDays < 0) counts.late += 1
      else if (diffDays < 14) counts.ongoing += 1
      else counts.upcoming += 1
    }
    return counts
  }, [sequences])

  async function handleDelete() {
    if (!id) return
    setActionLoading(true)
    try {
      await deleteAlternant(id)
      navigate('/peda/alternants')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible')
      setConfirmAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRemoveCompany() {
    if (!id) return
    setActionLoading(true)
    try {
      const updated = await removeAlternantCompany(id)
      if (updated) {
        setAlternant(updated)
        setSequences([])
      }
      setConfirmAction(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangeCompany(company: CompanyForm) {
    if (!id) return
    const updated = await changeAlternantCompany(id, company)
    if (updated) {
      setAlternant(updated)
      setSequences(await fetchSequences(id))
    }
  }

  async function handleCreateSequence() {
    if (!id || !newSaDate) return
    setSaLoading(true)
    try {
      const created = await createSequence(id, newSaDate)
      setSequences((prev) => [...prev, created].sort((a, b) => a.numero - b.numero))
      setNewSaDate('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création de la SA impossible')
    } finally {
      setSaLoading(false)
    }
  }

  async function handleToggleContact(seq: AlternantSequence, key: keyof SequenceContacts) {
    try {
      const updated = await updateSequenceContacts(seq.id, { [key]: !seq.contacts[key] })
      if (!updated) return
      setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      // 3/3 coché sur une SA en attente → affiche le callout de validation.
      const doneCount = [updated.contacts.mentor, updated.contacts.alternant, updated.contacts.formateur].filter(
        Boolean,
      ).length
      if (updated.status === 'pending' && doneCount === 3) {
        setPendingCompletionId(updated.id)
        setCompletionDate(new Date().toISOString().slice(0, 10))
      } else {
        setPendingCompletionId((cur) => (cur === updated.id ? null : cur))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible')
    }
  }

  async function handleCompleteSequence(seq: AlternantSequence) {
    if (!id || !completionDate) return
    setCompleting(true)
    try {
      const updated = await completeSequence(seq.id, completionDate)
      if (updated) {
        // Les SA suivantes ont été reprogrammées côté backend → recharge.
        setSequences(await fetchSequences(id))
        setPendingCompletionId(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation impossible')
    } finally {
      setCompleting(false)
    }
  }

  async function handleMark(seq: AlternantSequence, status: 'pending' | 'done' | 'not_done') {
    try {
      const updated = await markSequence(seq.id, status)
      if (updated) setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible')
    }
  }

  async function handleDeleteSequence(seqId: string) {
    try {
      await deleteSequence(seqId)
      setSequences((prev) => prev.filter((s) => s.id !== seqId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible')
    }
  }

  async function handleLink(otherId: string) {
    if (!id) return
    try {
      const updated = await linkAlternant(id, otherId)
      if (updated) {
        setAlternant(updated)
        const all = await fetchAlternants()
        const names: Record<string, string> = {}
        for (const other of all) names[other.id] = other.fullName
        setLinkedNames(names)
        setAllAlternants(all)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liaison impossible')
    }
  }

  async function handleUnlink(otherId: string) {
    if (!id) return
    try {
      const updated = await unlinkAlternant(id, otherId)
      if (updated) setAlternant(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liaison impossible')
    }
  }

  async function handleChangeSession(nextSessionId: string | null) {
    if (!id || !alternant) return
    setSessionSaving(true)
    try {
      const updated = nextSessionId
        ? await updateAlternant(id, { sessionId: nextSessionId })
        : await updateAlternant(id, { sessionId: null })
      if (updated) setAlternant(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Changement de session impossible')
    } finally {
      setSessionSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
        <IconLoader width={28} height={28} className="animate-spin" />
      </div>
    )
  }

  if (!alternant) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <Button variant="ghost" size="sm" leftIcon={<IconArrowLeft width={16} height={16} />} onClick={() => navigate('/peda/alternants')}>
          Retour aux alternants
        </Button>
        <p className="mt-6 text-[var(--ds-danger)]">{error ?? 'Alternant introuvable.'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" leftIcon={<IconArrowLeft width={16} height={16} />} onClick={() => navigate('/peda/alternants')}>
            Retour
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700/10 text-base font-bold text-teal-700">
            {(alternant.firstName[0] ?? '?').toUpperCase()}{(alternant.lastName[0] ?? '').toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--ds-text)]">{alternant.fullName}</h1>
            {alternant.sessionId ? (
              <Link
                to={`/peda/sessions/${alternant.sessionId}`}
                className="mt-0.5 inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-xs font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20 hover:opacity-80"
              >
                {alternant.session}
              </Link>
            ) : (
              <span className="mt-0.5 inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-xs font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20">
                {alternant.session}
              </span>
            )}
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
        {/* Section 1 : infos */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Informations" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <IconUser width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                <dt className="sr-only">Nom</dt>
                <dd className="font-semibold text-[var(--ds-text)]">{alternant.fullName}</dd>
              </div>
              <div className="flex items-center gap-2 text-[var(--ds-text-muted)]">
                <IconMail width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                <dd className="truncate">{alternant.email || '-'}</dd>
              </div>
              <div className="flex items-center gap-2 text-[var(--ds-text-muted)]">
                <IconPhone width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                <dd>{alternant.phone || '-'}</dd>
              </div>
            </dl>

            <h4 className="mb-2 mt-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">
              Session
            </h4>
            {alternant.sessionId && (
              <p className="mb-2 text-sm">
                <Link to={`/peda/sessions/${alternant.sessionId}`} className="font-semibold text-teal-700 hover:underline">
                  Voir le groupe « {alternant.session} »
                </Link>
              </p>
            )}
            <select
              value={alternant.sessionId ?? ''}
              disabled={sessionSaving}
              onChange={(e) => handleChangeSession(e.target.value || null)}
              aria-label="Changer de session"
              className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-3 pr-3 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] disabled:opacity-60"
            >
              <option value="">Hors groupe ({alternant.session})</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}{s.filiere ? ` · ${s.filiere}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
              Assigner ce jeune à une session met à jour son libellé automatiquement.
            </p>

            <h4 className="mb-2 mt-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">
              <IconCompany width={14} height={14} /> Entreprise
            </h4>
            {alternant.company ? (
              <dl className="space-y-2 text-sm text-[var(--ds-text-muted)]">
                <dd className="font-semibold text-[var(--ds-text)]">{alternant.company.name || '-'}</dd>
                {alternant.company.address && <dd>{alternant.company.address}</dd>}
                {alternant.company.mentorName && <dd>Maître d’apprentissage : {alternant.company.mentorName}</dd>}
                <dd className="flex items-center gap-2">
                  <IconCalendar width={14} height={14} className="shrink-0 text-[var(--ds-text-subtle)]" />
                  Du {formatDate(alternant.company.startDate)} au {formatDate(alternant.company.endDate)}
                </dd>
              </dl>
            ) : (
              <p className="text-sm italic text-[var(--ds-text-subtle)]">Plus d’entreprise.</p>
            )}

            <h4 className="mb-2 mt-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">
              <IconLink width={14} height={14} /> Suivi en commun ({linkedOthers.length})
            </h4>
            {linkedOthers.length === 0 ? (
              <p className="text-sm italic text-[var(--ds-text-subtle)]">Aucun jeune lié.</p>
            ) : (
              <ul className="space-y-1.5">
                {linkedOthers.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--ds-surface-sunken)] px-3 py-1.5 text-sm"
                  >
                    <span className="truncate font-medium text-[var(--ds-text)]">{l.name}</span>
                    <button
                      type="button"
                      onClick={() => handleUnlink(l.id)}
                      title={`Retirer ${l.name} du suivi commun`}
                      className="shrink-0 rounded-full p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
                    >
                      <IconUnlink width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" size="sm" className="mt-3" leftIcon={<IconPlus width={14} height={14} />} onClick={() => setLinkPickerOpen((v) => !v)}>
              Lier un jeune
            </Button>
            {linkPickerOpen && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--ds-border)] p-2">
                {linkable.length === 0 && (
                  <li className="px-3 py-2 text-[13px] text-[var(--ds-text-subtle)]">Aucun autre alternant.</li>
                )}
                {linkable.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => handleLink(a.id)}
                      className="w-full truncate rounded-lg px-3 py-1.5 text-left text-sm hover:bg-[var(--ds-surface-sunken)]"
                    >
                      {a.fullName} <span className="text-[var(--ds-text-subtle)]">· {a.session}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Séquences" description="État des séquences d’accompagnement" />
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ds-text-muted)]">Finalisées</span>
                <span className="inline-flex min-w-7 justify-center rounded-full bg-[var(--ds-success)]/15 px-2 py-0.5 text-[12px] font-bold text-[var(--ds-success)]">
                  {sequenceCounts.done}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ds-text-muted)]">En cours <span className="text-[var(--ds-text-subtle)]">(moins de 14 jours)</span></span>
                <span className="inline-flex min-w-7 justify-center rounded-full bg-teal-700/10 px-2 py-0.5 text-[12px] font-bold text-teal-700">
                  {sequenceCounts.ongoing}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ds-text-muted)]">En retard</span>
                <span className="inline-flex min-w-7 justify-center rounded-full bg-[var(--ds-danger-bg)] px-2 py-0.5 text-[12px] font-bold text-[var(--ds-danger)]">
                  {sequenceCounts.late}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ds-text-muted)]">À venir</span>
                <span className="inline-flex min-w-7 justify-center rounded-full bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[12px] font-bold text-[var(--ds-text-muted)]">
                  {sequenceCounts.upcoming}
                </span>
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Gestion" />
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" leftIcon={<IconEdit width={14} height={14} />} onClick={() => setShowEdit(true)}>
                Modifier
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<IconCompany width={14} height={14} />} onClick={() => setShowCompany(true)}>
                Changement d’entreprise
              </Button>
              {confirmAction === 'removeCompany' ? (
                <div className="rounded-xl border border-[var(--ds-danger)]/30 p-3">
                  <p className="text-[13px] text-[var(--ds-text-muted)]">
                    Le jeune n’a plus d’entreprise : infos entreprise et toutes ses SA seront supprimées.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" onClick={handleRemoveCompany} isLoading={actionLoading}>
                      Confirmer
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" size="sm" leftIcon={<IconClose width={14} height={14} />} onClick={() => setConfirmAction('removeCompany')}>
                  Plus d’entreprise
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconAlert width={14} height={14} />}
                disabled
                title="Disponible avec l’issue feat-peda-rupture (bientôt)."
              >
                Déclarer une rupture
              </Button>
              {confirmAction === 'delete' ? (
                <div className="rounded-xl border border-[var(--ds-danger)]/30 p-3">
                  <p className="text-[13px] text-[var(--ds-text-muted)]">Supprimer définitivement cet alternant et ses SA ?</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" onClick={handleDelete} isLoading={actionLoading}>
                      Confirmer
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" size="sm" leftIcon={<IconTrash width={14} height={14} />} onClick={() => setConfirmAction('delete')}>
                  Supprimer
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Section 2 : séquences d'accompagnement */}
        <Card className="h-fit">
          <CardHeader
            title={`Séquences d’accompagnement (${sequences.length})`}
            description="Prise de contact J+15, fin de période d’essai à 10 semaines, puis tous les 4 mois."
          />
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <InputField id="new-sa-date" label="Date de réalisation" type="date" value={newSaDate} onChange={(e) => setNewSaDate(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" leftIcon={<IconPlus width={14} height={14} />} onClick={handleCreateSequence} isLoading={saLoading} disabled={!newSaDate} className="shrink-0">
              Créer la SA
            </Button>
          </div>

          {sequences.length === 0 && (
            <p className="py-8 text-center text-sm italic text-[var(--ds-text-subtle)]">
              {alternant.company
                ? 'Aucune séquence pour l’instant.'
                : 'Sans entreprise, aucune séquence n’est planifiée.'}
            </p>
          )}

          <ul className="space-y-3">
            {sequences.map((seq) => (
              <li
                key={seq.id}
                className={[
                  'rounded-xl border p-4',
                  seq.status === 'done'
                    ? 'border-[var(--ds-success)]/30 bg-[var(--ds-success)]/5'
                    : seq.status === 'not_done'
                      ? 'border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] opacity-80'
                      : 'border-[var(--ds-border)] bg-[var(--ds-surface)]',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[var(--ds-text)]">SA n°{seq.numero}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--ds-text-muted)]">
                      <IconCalendar width={14} height={14} className="text-[var(--ds-text-subtle)]" />
                      Prévu le : {formatDate(seq.prevueLe)}
                      <span className="font-semibold text-teal-700">· {daysLabel(seq.prevueLe, seq.status, seq.realiseeLe)}</span>
                    </p>
                    {linkedOthers.length > 0 && seq.status === 'pending' && (
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-subtle)]">
                        <IconLink width={12} height={12} />
                        Suivi commun avec : {linkedOthers.map((l) => l.name).join(', ')} — pensez à faire leurs séquences en même temps.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<IconFile width={14} height={14} />}
                      disabled
                      title="Modèle PDF à venir (transmis au service informatique)."
                    >
                      Document
                    </Button>
                    {seq.status === 'not_done' ? (
                      <Button variant="secondary" size="sm" leftIcon={<IconCheck width={14} height={14} />} onClick={() => handleMark(seq, 'pending')}>
                        À replanifier
                      </Button>
                    ) : seq.status === 'done' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ds-success)]/15 px-3 py-1.5 text-[12px] font-bold text-[var(--ds-success)]">
                        <IconCheck width={13} height={13} /> Réalisée
                      </span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleMark(seq, 'not_done')}>
                        Non réalisé
                      </Button>
                    )}
                    {!seq.autoGenerated && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSequence(seq.id)}
                        title="Supprimer cette SA manuelle"
                        className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--ds-border)] pt-3">
                  {CONTACT_LABELS.map(({ key, label }) => (
                    <ContactCheckbox
                      key={key}
                      label={label}
                      checked={seq.contacts[key]}
                      onChange={() => handleToggleContact(seq, key)}
                    />
                  ))}
                  <span className="ml-auto text-[12px] font-semibold text-[var(--ds-text-subtle)]">
                    {seq.contactsDone}/3 contact{seq.contactsDone > 1 ? 's' : ''} effectué{seq.contactsDone > 1 ? 's' : ''}
                  </span>
                </div>
                {pendingCompletionId === seq.id && seq.status === 'pending' && seq.contactsDone === 3 && (
                  <div className="mt-3 rounded-xl border border-teal-700/30 bg-teal-700/5 p-3">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--ds-text)]">
                      <IconCheck width={14} height={14} className="text-teal-700" />
                      Séquence complète — date de réalisation (modifiable) :
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <InputField
                          id={`sa-realisee-${seq.id}`}
                          label="Date de réalisation"
                          type="date"
                          value={completionDate}
                          onChange={(e) => setCompletionDate(e.target.value)}
                        />
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCompleteSequence(seq)}
                          isLoading={completing}
                          disabled={!completionDate}
                        >
                          Valider
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPendingCompletionId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--ds-text-subtle)]">
                      Les SA suivantes seront reprogrammées à partir de cette date.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {showEdit && (
        <AlternantCreateModal
          initial={alternant}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setAlternant(updated)
            setShowEdit(false)
          }}
        />
      )}
      {showCompany && (
        <AlternantCompanyModal initial={alternant.company} onClose={() => setShowCompany(false)} onSubmit={handleChangeCompany} />
      )}
    </div>
  )
}
