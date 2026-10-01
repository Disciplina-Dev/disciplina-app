import { IconArrowLeft, IconBell, IconCalendar, IconCheck, IconCompany, IconCopy, IconFile, IconForbidden, IconHash, IconJob, IconMail, IconMapPin, IconPhone, IconTaskList, IconTrash, IconUser, IconUserCheck } from '@/components/ui/icons'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation, useBlocker } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Entreprise, EntrepriseStatus } from '@/types/entreprise'
import type { NeedsAnalysis } from '@/types/needsAnalysis'
import { STATUS_VALUES } from '@/types/entreprise'
import { ALL_COMPANY_SECTEURS, companySecteursForRegion } from '@/constants/secteurs'
import { useRegionStore } from '@/store/regionStore'
import { useCurrentUser, UserRole, Permission } from '@/store/authStore'
import { useStaffDirectory } from '@/hooks/useStaffDirectory'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useNeedsAnalysesByCompany, useDeleteNeedsAnalysis, useUpdateCompany, useCreateCompany } from '@/graphql/hooks'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import { useCommercialMailTemplatesStore } from '@/store/mailTemplatesStore'
import { RELANCE_TYPES, getRelanceType, computeRelanceDate } from '@/types/relance'
import { toSlug } from '@/utils/slug'
import { toCompany, toEntrepriseFromCompanyWithSalePerson } from '@/types/companyMapper'
import { normalizeSiret } from '@/types/sourcing'
import type { SireneEtablissement } from '@/types/sourcing'
import LinkedEstablishments from '@/features/portefeuille/components/LinkedEstablishments'
import CompanyTimeline from '@/features/portefeuille/components/CompanyTimeline'
import ContactLogModal from '@/features/portefeuille/components/ContactLogModal'
import CreateEditModal from '@/features/portefeuille/components/CreateEditModal'
import BanCompanyModal from '@/features/portefeuille/components/BanCompanyModal'
import UnsavedChangesBar from '@/features/portefeuille/components/UnsavedChangesBar'
import LeaveConfirmDialog from '@/features/portefeuille/components/LeaveConfirmDialog'
import { formatErrorMessage } from '@/utils/companyErrors'
import type { CompanyWithSalePerson } from '@/types/entreprise'

const STATUS_OPTIONS: EntrepriseStatus[] = STATUS_VALUES

const STATUS_CONFIG: Record<EntrepriseStatus, { bg: string; text: string; dot: string; border: string }> = {
  Oui:          { bg: 'bg-[var(--ds-success-bg)]',  text: 'text-[var(--ds-success)]',  dot: 'bg-success',  border: 'border-success/30' },
  'Oui OF':     { bg: 'bg-[var(--ds-success-bg)]',  text: 'text-[var(--ds-success)]',  dot: 'bg-success',  border: 'border-success/30' },
  Non:          { bg: 'bg-[var(--ds-danger-bg)]',   text: 'text-[var(--ds-danger)]',   dot: 'bg-danger',   border: 'border-danger/30' },
  'À Réfléchir':{ bg: 'bg-[var(--ds-warning-bg)]',  text: 'text-[var(--ds-warning)]',  dot: 'bg-warning',  border: 'border-warning/30' },
  Relance:      { bg: 'bg-blue/10',     text: 'text-blue',     dot: 'bg-blue',     border: 'border-blue/30' },
  'Réponds pas':{ bg: 'bg-[var(--ds-surface-sunken)]',    text: 'text-[var(--ds-text-subtle)]', dot: 'bg-[var(--ds-text-subtle)]', border: 'border-[var(--ds-border-strong)]' },
  Fermé:        { bg: 'bg-[var(--ds-surface-sunken)]',    text: 'text-[var(--ds-text-muted)]', dot: 'bg-[var(--ds-text-muted)]', border: 'border-[var(--ds-border-strong)]' },
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  BROUILLON:            { bg: 'bg-[var(--ds-surface-sunken)]',   text: 'text-[var(--ds-text-muted)]',   label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE: { bg: 'bg-[var(--ds-warning-bg)]', text: 'text-[var(--ds-warning)]', label: 'En attente de signature' },
  SIGNE:                { bg: 'bg-[var(--ds-success-bg)]',  text: 'text-[var(--ds-success)]',  label: 'Signé' },
  EXPIRE:               { bg: 'bg-[var(--ds-danger-bg)]',    text: 'text-[var(--ds-danger)]',    label: 'Expiré' },
}

// ─── Inline input styles ──────────────────────────────────────────────────────
const INLINE_INPUT = [
  'w-full bg-transparent border-b border-transparent text-sm text-[var(--ds-text)]',
  'transition-colors duration-100 outline-none px-0 py-0.5',
  'hover:border-[var(--ds-border)] focus:border-blue placeholder:text-[var(--ds-text-subtle)]',
].join(' ')

const INLINE_TEXTAREA = [
  'w-full bg-transparent border border-transparent rounded-lg text-sm text-[var(--ds-text-muted)]',
  'transition-colors duration-100 outline-none px-3 py-2 resize-none leading-relaxed',
  'hover:border-[var(--ds-border)] hover:bg-[var(--ds-surface-sunken)] focus:border-blue focus:bg-[var(--ds-surface)]',
  'placeholder:text-[var(--ds-text-subtle)]',
].join(' ')

const INLINE_SELECT = [
  'bg-transparent border-b border-transparent text-sm text-[var(--ds-text)]',
  'transition-colors duration-100 outline-none px-0 py-0.5 cursor-pointer',
  'hover:border-[var(--ds-border)] focus:border-blue',
].join(' ')

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), 'd MMM yyyy', { locale: fr }) } catch { return iso }
}

// ─── Read-only field ──────────────────────────────────────────────────────────
function ReadField({ icon, label, value, copyable }: { icon: React.ReactNode; label: string; value: string | null | undefined; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value && !label) return null
  const copy = () => value && navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-[var(--ds-text)] break-all">{value ?? <span className="text-[var(--ds-text-subtle)] italic text-xs">—</span>}</p>
          {copyable && value && (
            <button onClick={copy} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ds-text-subtle)] transition-colors hover:bg-blue-light hover:text-blue">
              {copied ? <IconCheck className="h-3.5 w-3.5 text-[var(--ds-success)]" /> : <IconCopy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Editable field ───────────────────────────────────────────────────────────
function EditField({ icon, label, value, onChange, placeholder, type = 'text' }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-0.5">{label}</p>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Saisir ${label.toLowerCase()}…`}
          className={INLINE_INPUT}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EntreprisePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useCurrentUser()
  const { directory } = useStaffDirectory()
  const companies = usePortefeuilleStore((s) => s.companies)
  const { update } = useUpdateCompany()
  const { createCompany } = useCreateCompany()
  const mailTemplates = useCommercialMailTemplatesStore((s) => s.templates)
  const loadMailTemplates = useCommercialMailTemplatesStore((s) => s.load)

  useEffect(() => { loadMailTemplates() }, [loadMailTemplates])

  const [abOpen, setAbOpen] = useState(false)
  const [abEditTarget, setAbEditTarget] = useState<{ data: NeedsAnalysis; duplicate: boolean } | null>(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [selectedAbId, setSelectedAbId] = useState<string | null>(null)
  const [selectedAbIds, setSelectedAbIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addPrefillSiret, setAddPrefillSiret] = useState<string | undefined>()
  const [banOpen, setBanOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactRefresh, setContactRefresh] = useState(0)
  const region = useRegionStore((s) => s.region)
  const secteurOptions = companySecteursForRegion(region)

  const stateEntreprise = location.state?.entreprise as Entreprise | undefined
  const baseEntreprise: Entreprise | undefined =
    stateEntreprise ?? companies.find((c) => toSlug(c.nom_commercial ?? '') === slug)

  const [draft, setDraft] = useState<Entreprise | null>(null)

  useEffect(() => {
    if (baseEntreprise && !draft) setDraft({ ...baseEntreprise })
  }, [baseEntreprise])

  const abResult = useNeedsAnalysesByCompany(baseEntreprise?.id ? Number(baseEntreprise.id) : null)
  const abList = abResult.data?.needsAnalysesByCompany ?? []
  const { deleteNeedsAnalysis } = useDeleteNeedsAnalysis()

  // ─── Détection des modifications non enregistrées ───────────────────────────
  const bypassBlockRef = useRef(false)
  const isDirty = !!draft && !!baseEntreprise && JSON.stringify(draft) !== JSON.stringify(baseEntreprise)

  // Bloque la navigation interne (React Router) tant que des modifs sont en attente
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !bypassBlockRef.current && currentLocation.pathname !== nextLocation.pathname,
  )

  // Avertit avant fermeture / rechargement de l'onglet
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  if (!baseEntreprise || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-[var(--ds-text-subtle)] text-sm mb-3">Entreprise introuvable.</p>
          <Button size="sm" variant="secondary" onClick={() => navigate('/commercial/portefeuille')}>Retour au portefeuille</Button>
        </div>
      </div>
    )
  }

  const canEdit =
    currentUser?.permission === Permission.ADMIN ||
    currentUser?.permission === Permission.RESPONSABLE ||
    String(baseEntreprise.proprietaire_id) === String(currentUser?.id)

  const set = <K extends keyof Entreprise>(key: K, value: Entreprise[K]) =>
    setDraft((d) => d ? { ...d, [key]: value } : d)

  // Persiste le draft. Retourne true si succès.
  const persist = async (): Promise<boolean> => {
    setSaving(true)
    setSaveError(null)
    const response = await update(Number(draft.id), toCompany(draft))
    setSaving(false)
    if (response.error) {
      setSaveError(response.error.message)
      return false
    }
    return true
  }

  // Barre : enregistrer et rester sur la page
  const handleSave = async () => {
    if (!isDirty) return
    const ok = await persist()
    if (!ok) return
    bypassBlockRef.current = true
    navigate(`/commercial/portefeuille/${toSlug(draft.nom_commercial ?? draft.id)}`, {
      replace: true,
      state: { entreprise: draft },
    })
    // Force le rafraîchissement de l'historique pour voir la modif immédiatement.
    setContactRefresh((n) => n + 1)
    setTimeout(() => { bypassBlockRef.current = false }, 0)
  }

  // Barre : annuler les modifications
  const handleDiscard = () => setDraft({ ...baseEntreprise })

  // Dialog quitter : enregistrer puis poursuivre la navigation bloquée
  const handleSaveAndLeave = async () => {
    const ok = await persist()
    if (ok) blocker.proceed?.()
  }

  const toggleSelect = (id: string) => {
    setSelectedAbIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const handleBulkDelete = async () => {
    await Promise.all([...selectedAbIds].map((id) => deleteNeedsAnalysis(id)))
    setSelectedAbIds(new Set())
    abResult.refetch()
  }

  const handleAddFromSiren = (etab: SireneEtablissement) => {
    setAddPrefillSiret(etab.siret)
    setAddModalOpen(true)
  }

  const handleOpenLinkedCompany = (item: CompanyWithSalePerson) => {
    const entreprise = toEntrepriseFromCompanyWithSalePerson(item)
    navigate(`/commercial/portefeuille/${toSlug(entreprise.nom_commercial ?? entreprise.id)}`, {
      state: { entreprise },
    })
  }

  const handleCreateCompany = async (data: Partial<Entreprise>) => {
    const company = toCompany(data)
    try {
      const response = await createCompany(company)
      if (response.error) {
        const friendlyMsg = formatErrorMessage(response.error.message, data.siret)
        alert(`Erreur lors de la création : ${friendlyMsg}`)
        return
      }
      setAddModalOpen(false)
      setAddPrefillSiret(undefined)
    } catch (err: any) {
      console.error(err)
      alert(`Erreur lors de la création : ${err.message || err}`)
    }
  }

  const statusCfg = STATUS_CONFIG[draft.status] ?? STATUS_CONFIG['Non']
  const owner = draft.proprietaire_id ? directory[String(draft.proprietaire_id)] : null
  const commercialUsers = Object.values(directory).filter((u) => u.role === UserRole.COMMERCIAL)
  const siren = draft.siret ? normalizeSiret(draft.siret).slice(0, 9) : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-lg px-4 py-8 sm:px-6 lg:px-8">

        {/* ─── Back ───────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/commercial/portefeuille')}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)] transition-colors mb-6"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Portefeuille
        </button>

        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-light">
              <IconCompany className="h-6 w-6 text-blue" />
            </div>
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <input
                  type="text"
                  value={draft.nom_commercial ?? ''}
                  onChange={(e) => set('nom_commercial', e.target.value)}
                  placeholder="Nom de l'entreprise"
                  className="text-[24px] font-extrabold tracking-tight text-[var(--ds-text)] leading-tight w-full bg-transparent border-b border-transparent hover:border-[var(--ds-border)] focus:border-blue outline-none transition-colors"
                />
              ) : (
                <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--ds-text)] leading-tight">
                  {draft.nom_commercial ?? 'Entreprise sans nom'}
                </h1>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {canEdit ? (
                  <select
                    value={draft.status}
                    onChange={(e) => set('status', e.target.value as EntrepriseStatus)}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer outline-none ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {draft.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-4">
            <Button size="sm" variant="secondary" leftIcon={<IconPhone className="h-3.5 w-3.5" />} onClick={() => setContactOpen(true)}>
              Prise de contact
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<IconMail className="h-3.5 w-3.5" />} onClick={() => setMailOpen(true)}>
              Envoyer un mail
            </Button>
            <Button size="sm" variant="primary" leftIcon={<IconFile className="h-3.5 w-3.5" />} onClick={() => setAbOpen(true)}>
              Créer une Analyse (AB)
            </Button>
            {canEdit && (
              <Button size="sm" variant="danger" leftIcon={<IconForbidden className="h-3.5 w-3.5" />} onClick={() => setBanOpen(true)}>
                Bannir
              </Button>
            )}
          </div>
        </div>

        {saveError && (
          <div className="mb-4 rounded-xl border border-danger/20 bg-[var(--ds-danger-bg)] px-4 py-2.5 text-sm text-[var(--ds-danger)]">{saveError}</div>
        )}

        {/* ─── Content ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

            {/* Left — Infos générales */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest">Informations générales</p>

              {/* SIRET — read only */}
              <ReadField icon={<IconHash className="h-4 w-4" />} label="SIRET" value={draft.siret} />

              {canEdit ? (
                <EditField icon={<IconJob className="h-4 w-4" />} label="Métier / Description" value={draft.metier ?? ''} onChange={(v) => set('metier', v)} />
              ) : (
                <ReadField icon={<IconJob className="h-4 w-4" />} label="Métier / Description" value={draft.metier} />
              )}
              {canEdit ? (
                <EditField icon={<IconMapPin className="h-4 w-4" />} label="Adresse" value={draft.adresse ?? ''} onChange={(v) => set('adresse', v)} />
              ) : (
                <ReadField icon={<IconMapPin className="h-4 w-4" />} label="Adresse" value={draft.adresse} />
              )}
              {canEdit ? (
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]"><IconMapPin className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-1.5">Secteur</p>
                    <div className="flex flex-wrap gap-2">
                      {secteurOptions.map((s) => {
                        const secteurs = (draft.secteur ?? '').split(',').map((x) => x.trim()).filter(Boolean)
                        const active = secteurs.includes(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const current = (draft.secteur ?? '').split(',').map((x) => x.trim()).filter(Boolean)
                              const valid = current.filter((x) => (ALL_COMPANY_SECTEURS as string[]).includes(x))
                              const next = active ? valid.filter((x) => x !== s) : [...valid, s]
                              // Valeurs du tenant d'abord, puis les valeurs stockées
                              // hors vocabulaire (jamais perdues à l'édition).
                              const ordered = [
                                ...secteurOptions.filter((v) => next.includes(v)),
                                ...next.filter((v) => !secteurOptions.includes(v)),
                              ]
                              set('secteur', ordered.length ? ordered.join(', ') : '')
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-blue bg-blue text-white'
                                : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] hover:border-[var(--ds-border-strong)] hover:text-[var(--ds-text)]'
                            }`}
                          >
                            {active && <IconCheck className="h-3 w-3" />}
                            {s}
                          </button>
                        )
                      })}
                    </div>
                    {!(draft.secteur ?? '').split(',').map((x) => x.trim()).filter(Boolean).length && (
                      <p className="text-xs text-[var(--ds-danger)] mt-1.5">Sélectionnez au moins un secteur</p>
                    )}
                  </div>
                </div>
              ) : (
                <ReadField icon={<IconMapPin className="h-4 w-4" />} label="Secteur" value={draft.secteur} />
              )}
              {canEdit ? (
                <EditField icon={<IconHash className="h-4 w-4" />} label="IDCC" value={draft.idcc ?? ''} onChange={(v) => set('idcc', v)} />
              ) : (
                <ReadField icon={<IconHash className="h-4 w-4" />} label="IDCC" value={draft.idcc} />
              )}
              {canEdit ? (
                <EditField icon={<IconUser className="h-4 w-4" />} label="Représentant légal" value={draft.representant_legal ?? ''} onChange={(v) => set('representant_legal', v)} />
              ) : (
                <ReadField icon={<IconUser className="h-4 w-4" />} label="Représentant légal" value={draft.representant_legal} />
              )}
            </div>

            {/* Right — Contact + Suivi */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest">Contact</p>

              {canEdit ? (
                <EditField icon={<IconPhone className="h-4 w-4" />} label="Téléphone" value={draft.telephone ?? ''} onChange={(v) => set('telephone', v)} type="tel" />
              ) : (
                <ReadField icon={<IconPhone className="h-4 w-4" />} label="Téléphone" value={draft.telephone} />
              )}
              {canEdit ? (
                <EditField icon={<IconMail className="h-4 w-4" />} label="Adresse e-mail" value={draft.email ?? ''} onChange={(v) => set('email', v)} type="email" />
              ) : (
                <ReadField icon={<IconMail className="h-4 w-4" />} label="Adresse e-mail" value={draft.email} copyable />
              )}

              <div className="pt-4 border-t border-[var(--ds-border)]">
                <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-3">Suivi commercial</p>
                <div className="space-y-4">

                  {/* Propriétaire */}
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]"><IconUserCheck className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-0.5">Propriétaire</p>
                      {canEdit ? (
                        <select
                          value={String(draft.proprietaire_id ?? '')}
                          onChange={(e) => {
                            const u = directory[e.target.value]
                            set('proprietaire_id', u ? Number(e.target.value) : null)
                            set('commercial', u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null : null)
                          }}
                          className={INLINE_SELECT}
                        >
                          <option value="">Non attribué</option>
                          {commercialUsers.map((u) => (
                            <option key={u.id} value={u.id}>{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()}</option>
                          ))}
                        </select>
                      ) : owner ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: owner.color }}>{owner.initials}</span>
                          <span className="text-sm text-[var(--ds-text)]">{`${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()}</span>
                          <span className="text-xs text-[var(--ds-text-subtle)]">({owner.role})</span>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--ds-text-subtle)] italic">Non attribué</p>
                      )}
                    </div>
                  </div>

                  {/* Date insertion — read only */}
                  <ReadField icon={<IconCalendar className="h-4 w-4" />} label="Date d'insertion" value={formatDate(draft.date_insertion)} />

                  {/* Type de relance — editable, recalcule la date */}
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]"><IconBell className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-0.5">Type de relance</p>
                      {canEdit ? (
                        <select
                          value={draft.type_relance ?? ''}
                          onChange={(e) => {
                            const typeId = e.target.value ? Number(e.target.value) : null
                            setDraft((d) => d ? {
                              ...d,
                              type_relance: typeId,
                              date_relance: typeId ? computeRelanceDate(typeId) : null,
                            } : d)
                          }}
                          className={INLINE_INPUT}
                        >
                          <option value="">— Aucun —</option>
                          {RELANCE_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>{t.label} · {t.description}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-[var(--ds-text)]">{getRelanceType(draft.type_relance)?.label ?? <span className="text-[var(--ds-text-subtle)] italic text-xs">—</span>}</p>
                      )}
                    </div>
                  </div>

                  {/* Date relance — editable */}
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]"><IconBell className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-0.5">Date de relance</p>
                      {canEdit ? (
                        <input
                          type="date"
                          value={draft.date_relance ?? ''}
                          onChange={(e) => set('date_relance', e.target.value || null)}
                          className={INLINE_INPUT}
                        />
                      ) : (
                        <p className="text-sm text-[var(--ds-text)]">{formatDate(draft.date_relance) ?? <span className="text-[var(--ds-text-subtle)] italic text-xs">—</span>}</p>
                      )}
                    </div>
                  </div>

                  {/* Modèle de mail pour la relance */}
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]"><IconMail className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide mb-0.5">IconMail type de relance</p>
                      {canEdit ? (
                        <select
                          value={draft.relance_template_id ?? ''}
                          onChange={(e) => set('relance_template_id', e.target.value || null)}
                          className={INLINE_INPUT}
                        >
                          <option value="">— Aucun —</option>
                          {mailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-[var(--ds-text)]">{mailTemplates.find((t) => t.id === draft.relance_template_id)?.name ?? <span className="text-[var(--ds-text-subtle)] italic text-xs">—</span>}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes + Conclusion */}
          <div className="mt-6 pt-6 border-t border-[var(--ds-border)] grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <IconFile className="h-3.5 w-3.5" />Note
              </p>
              {canEdit ? (
                <textarea
                  rows={4}
                  value={draft.note ?? ''}
                  onChange={(e) => set('note', e.target.value)}
                  placeholder="Ajouter une note…"
                  className={INLINE_TEXTAREA}
                />
              ) : (
                <p className="text-sm text-[var(--ds-text-muted)] bg-[var(--ds-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {draft.note ?? <span className="text-[var(--ds-text-subtle)] italic">Aucune note</span>}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <IconFile className="h-3.5 w-3.5" />Conclusion
              </p>
              {canEdit ? (
                <textarea
                  rows={4}
                  value={draft.conclusion ?? ''}
                  onChange={(e) => set('conclusion', e.target.value)}
                  placeholder="Ajouter une conclusion…"
                  className={INLINE_TEXTAREA}
                />
              ) : (
                <p className="text-sm text-[var(--ds-text-muted)] bg-[var(--ds-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {draft.conclusion ?? <span className="text-[var(--ds-text-subtle)] italic">Aucune conclusion</span>}
                </p>
              )}
            </div>
          </div>

          {/* Analyses du besoin */}
          <div className="mt-6 pt-6 border-t border-[var(--ds-border)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest flex items-center gap-1.5">
                <IconTaskList className="h-3.5 w-3.5" />Analyses du besoin
              </p>
              {selectedAbIds.size > 0 && (
                <button onClick={handleBulkDelete} className="flex items-center gap-1.5 rounded-lg bg-[var(--ds-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--ds-danger)] hover:bg-[var(--ds-danger-bg)] transition-colors">
                  <IconTrash className="h-3.5 w-3.5" />Supprimer ({selectedAbIds.size})
                </button>
              )}
            </div>
            {abResult.fetching && <p className="text-sm text-[var(--ds-text-subtle)] italic">Chargement...</p>}
            {!abResult.fetching && abList.length === 0 && <p className="text-sm text-[var(--ds-text-subtle)] italic">Aucune analyse du besoin pour cette entreprise.</p>}
            {abList.length > 0 && (
              <ul className="space-y-2">
                {abList.map((ab: any) => {
                  const badge = STATUS_BADGE[ab.status] ?? STATUS_BADGE['BROUILLON']
                  const isSelected = selectedAbIds.has(ab.id)
                  return (
                    <li
                      key={ab.id}
                      onClick={() => setSelectedAbId(ab.id)}
                      className={['flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors', isSelected ? 'bg-[var(--ds-accent-soft)] border border-[var(--ds-accent)]' : 'bg-[var(--ds-surface-sunken)] hover:bg-[var(--ds-accent-soft)]'].join(' ')}
                    >
                      <input type="checkbox" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(ab.id)} className="h-4 w-4 shrink-0 rounded border-[var(--ds-border-strong)] accent-blue cursor-pointer" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[var(--ds-text)] truncate">{ab.positions?.[0]?.title ?? 'Analyse du besoin'}</span>
                        <span className="ml-2 text-xs text-[var(--ds-text-subtle)]">{ab.positionsCount} poste{ab.positionsCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ab.createdAt && <span className="text-xs text-[var(--ds-text-subtle)]">{formatDate(ab.createdAt)}</span>}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {selectedAbId && (
              <ABDetailModal
                id={selectedAbId}
                onClose={() => setSelectedAbId(null)}
                onDelete={() => { setSelectedAbId(null); abResult.refetch() }}
                onEdit={(ab) => { setSelectedAbId(null); setAbEditTarget({ data: ab, duplicate: false }) }}
                onDuplicate={(ab) => { setSelectedAbId(null); setAbEditTarget({ data: ab, duplicate: true }) }}
              />
            )}
          </div>

          {/* Établissements liés */}
          {siren && siren.length === 9 && (
            <LinkedEstablishments
              siren={siren}
              currentSiret={draft.siret ?? null}
              onAdd={handleAddFromSiren}
              onOpenCompany={handleOpenLinkedCompany}
            />
          )}

          {/* Timeline unifiée : prises de contact + modifications */}
          {baseEntreprise && baseEntreprise.id && (
            <CompanyTimeline companyID={Number(baseEntreprise.id)} refreshKey={contactRefresh} />
          )}
        </div>
      </div>

      {abOpen && currentUser && (
        <NeedsAnalysisModal entreprise={baseEntreprise} currentUser={currentUser} onClose={() => setAbOpen(false)} onSuccess={() => setAbOpen(false)} />
      )}

      {abEditTarget && currentUser && (
        <NeedsAnalysisModal
          entreprise={baseEntreprise}
          currentUser={currentUser}
          initialData={abEditTarget.data}
          isDuplicate={abEditTarget.duplicate}
          onClose={() => setAbEditTarget(null)}
          onSuccess={() => { setAbEditTarget(null); abResult.refetch() }}
        />
      )}

      {mailOpen && (
        <MailModal
          defaultTo={draft.email ?? ''}
          candidateName={draft.nom_commercial ?? undefined}
          scope="commercial"
          mode="draft"
          onClose={() => setMailOpen(false)}
        />
      )}

      {addModalOpen && currentUser && (
        <CreateEditModal
          mode="create"
          prefillSiret={addPrefillSiret}
          currentUser={currentUser}
          onSave={handleCreateCompany}
          onClose={() => {
            setAddModalOpen(false)
            setAddPrefillSiret(undefined)
          }}
        />
      )}

      {banOpen && (
        <BanCompanyModal
          entreprise={draft}
          onClose={() => setBanOpen(false)}
          onSuccess={() => navigate('/commercial/portefeuille')}
        />
      )}

      {contactOpen && baseEntreprise?.id && (
        <ContactLogModal
          entreprise={draft}
          onClose={() => setContactOpen(false)}
          onSuccess={() => {
            setContactOpen(false)
            setContactRefresh((n) => n + 1)
          }}
        />
      )}

      {/* Barre flottante d'enregistrement */}
      <UnsavedChangesBar
        visible={isDirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* Confirmation avant de quitter la page avec des modifs non enregistrées */}
      <LeaveConfirmDialog
        open={blocker.state === 'blocked'}
        saving={saving}
        onCancel={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
        onSave={handleSaveAndLeave}
      />
    </div>
  )
}
