import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { IconBell, IconCheckCircle, IconCompany, IconErrorCircle, IconMail, IconPhone, IconSchedule, IconSend } from '@/components/ui/icons'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import type { Entreprise } from '@/types/entreprise'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio } from '@/graphql/useInitializePortfolio'
import { useCurrentUser } from '@/store/authStore'
import { getRelanceType, RELANCE_TYPES } from '@/types/relance'
import { sendCompanyMailRelance } from '@/api/relance'
import { apiJson } from '@/api/httpClient'
import { useCommercialMailTemplatesStore } from '@/store/mailTemplatesStore'
import { cleanHtml } from '@/services/sanitizeHtml'
import { toSlug } from '@/utils/slug'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import ContactLogModal from '@/features/portefeuille/components/ContactLogModal'

/** Groupe les entreprises par type de relance, dans l'ordre de RELANCE_TYPES (sans type en dernier) */
function groupByType(list: Entreprise[]) {
  const groups: { typeId: number | null; items: Entreprise[] }[] = []
  for (const t of RELANCE_TYPES) {
    const items = list.filter((c) => c.type_relance === t.id)
    if (items.length > 0) groups.push({ typeId: t.id, items })
  }
  const untyped = list.filter((c) => !getRelanceType(c.type_relance))
  if (untyped.length > 0) groups.push({ typeId: null, items: untyped })
  return groups
}

type DateMode = 'all' | 'days' | 'exact' | 'range'

const FIELD = 'rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text-muted)]'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: fr })
  } catch {
    return iso
  }
}

export default function RelanceCommercial() {
  const navigate = useNavigate()
  const companies = usePortefeuilleStore((s) => s.companies)
  const salePersons = usePortefeuilleStore((s) => s.salePersons)
  const clearCompanyRelance = usePortefeuilleStore((s) => s.updateCompany)
  const currentUser = useCurrentUser()

  // Par défaut on ne voit que ses propres relances ; null = tous les commerciaux.
  const [ownerId, setOwnerId] = useState<number | null>(currentUser ? Number(currentUser.id) : null)

  // Filtre date : aucun / N prochains jours / date précise / période [du, au]
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [days, setDays] = useState(7)
  const [exactDate, setExactDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [mailFor, setMailFor] = useState<Entreprise | null>(null)
  const [contactFor, setContactFor] = useState<Entreprise | null>(null)

  // Mode groupé asynchrone
  const [bulkMode, setBulkMode] = useState(false)
  const portfolioLimit = useMemo(() => (bulkMode ? 10000 : 200), [bulkMode])
  const { loading } = useInitializePortfolio(portfolioLimit)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ message: string } | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [sendMode, setSendMode] = useState<'all' | 'specific'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [manuallySelected, setManuallySelected] = useState<Entreprise[]>([])
  const templates = useCommercialMailTemplatesStore((s) => s.templates)
  const loadTemplates = useCommercialMailTemplatesStore((s) => s.load)

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const template = templates.find((t) => t.id === selectedTemplateId) ?? null

  const filteredSearch = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    const alreadySelected = new Set(manuallySelected.map((e) => e.id))
    return companies.filter(
      (c) =>
        !alreadySelected.has(c.id) &&
        (c.nom_commercial?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.siret?.includes(term)),
    )
  }, [searchTerm, companies, manuallySelected])

  function addCompany(e: Entreprise) {
    setManuallySelected((prev) => [...prev, e])
    setSearchTerm('')
  }

  function removeCompany(id: string) {
    setManuallySelected((prev) => prev.filter((c) => c.id !== id))
  }

  // Local date (not UTC) so a relance set for "today" is due all day in the user's timezone
  const today = format(new Date(), 'yyyy-MM-dd')
  // Borne haute du mode « N prochains jours » (bornes incluses, aujourd'hui compris).
  const daysLimit = format(addDays(new Date(), Math.max(0, days - 1)), 'yyyy-MM-dd')

  function matchesDate(d: string) {
    switch (dateMode) {
      case 'days':
        return d <= daysLimit
      case 'exact':
        return !exactDate || d === exactDate
      case 'range':
        return (!from || d >= from) && (!to || d <= to)
      default:
        return true
    }
  }

  const withRelance = companies.filter(
    (c) =>
      c.date_relance &&
      (ownerId === null || c.proprietaire_id === ownerId) &&
      matchesDate(c.date_relance),
  )
  const due = withRelance
    .filter((c) => c.date_relance! <= today)
    .sort((a, b) => a.date_relance!.localeCompare(b.date_relance!))
  const upcoming = withRelance
    .filter((c) => c.date_relance! > today)
    .sort((a, b) => a.date_relance!.localeCompare(b.date_relance!))

  // Une fois la relance faite (mail envoyé ou appel résumé), l'entreprise sort de
  // la liste : on vide ses champs de relance localement (le backend les a déjà NULL).
  function dropFromList(id: string) {
    clearCompanyRelance(id, { date_relance: null, type_relance: null, relance_template_id: null, relance_channel: null })
  }

  // Prise de contact (comme la fiche entreprise) : le modal a déjà écrit en base.
  // On synchronise le store local avec le nouvel état de relance ; la ligne sort
  // de la liste si la date est vidée, ou passe dans « À venir » si elle est future.
  function onContactSuccess(ent: Entreprise, applied?: { status: string; type_relance: number | null; date_relance: string | null }) {
    if (applied) {
      clearCompanyRelance(ent.id, {
        status: applied.status as Entreprise['status'],
        type_relance: applied.type_relance,
        date_relance: applied.date_relance,
      })
    }
    setContactFor(null)
  }

  async function sendMailRelance(ent: Entreprise, mail: { to: string; subject: string; body: string; attachments: { filename: string; contentType: string; content: string }[] }) {
    await sendCompanyMailRelance(Number(ent.id), {
      to: mail.to,
      subject: mail.subject,
      html: mail.body,
      text: mail.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      attachments: mail.attachments,
      typeRelance: ent.type_relance,
    })
    dropFromList(ent.id)
  }

  // ── Mode groupé ──────────────────────────────────────────────────────

  async function handleBulkSend() {
    if (sending || !selectedTemplateId) return
    setSending(true)
    setBulkResult(null)
    setBulkError(null)
    try {
      const body = sendMode === 'all'
        ? JSON.stringify({ all: true, templateId: selectedTemplateId })
        : JSON.stringify({ ids: manuallySelected.map((c) => Number(c.id)).filter((n) => !Number.isNaN(n)), templateId: selectedTemplateId })
      const data = await apiJson<{ message: string }>('/api/relance/company/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      setBulkResult(data)
      setManuallySelected([])
      setSearchTerm('')
    } catch (err: any) {
      setBulkError(err.message)
    } finally {
      setSending(false)
    }
  }

  const canSend = sendMode === 'all' || manuallySelected.length > 0

  function TypeGroup({ typeId, count, children }: { typeId: number | null; count: number; children: ReactNode }) {
    const type = getRelanceType(typeId ?? undefined)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 mt-1">
          {type ? (
            <>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${type.badge.bg} ${type.badge.text}`}>
                {type.label}
              </span>
              <span className="text-xs text-[var(--ds-text-subtle)]">{type.description}</span>
            </>
          ) : (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
              Sans type
            </span>
          )}
          <span className="ml-auto text-xs text-[var(--ds-text-subtle)]">{count}</span>
        </div>
        {children}
      </div>
    )
  }

  function Row({ ent, isDue }: { ent: Entreprise; isDue: boolean }) {
    const channel = ent.relance_channel ?? (ent.email ? 'MAIL' : 'PHONE')
    return (
      <div className="flex items-center gap-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-4 hover:border-blue/20 transition-colors">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light">
          <IconCompany className="h-5 w-5 text-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/commercial/portefeuille/${toSlug(ent.nom_commercial ?? ent.id)}`, { state: { entreprise: ent } })}
            className="font-semibold text-[var(--ds-text)] truncate hover:text-blue transition-colors text-left"
          >
            {ent.nom_commercial ?? 'Entreprise sans nom'}
          </button>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${isDue ? 'text-[var(--ds-danger)]' : 'text-[var(--ds-text-subtle)]'}`}>
              <IconSchedule className="h-3.5 w-3.5" />
              {formatDate(ent.date_relance)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-xs font-medium text-[var(--ds-text-muted)]">
              {channel === 'MAIL' ? <><IconMail className="h-3 w-3" /> IconMail</> : <><IconPhone className="h-3 w-3" /> Téléphone</>}
            </span>
            {channel === 'MAIL' && !ent.email && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--ds-warning)]">
                <IconMail className="h-3 w-3" />
                E-mail manquant
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {channel === 'MAIL' && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<IconMail className="h-3.5 w-3.5" />}
              disabled={!ent.email}
              onClick={() => setMailFor(ent)}
              title={ent.email ? 'Préparer et envoyer le mail de relance' : 'Pas d’email renseigné'}
            >
              Préparer le mail
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<IconPhone className="h-3.5 w-3.5" />}
            onClick={() => setContactFor(ent)}
            title="Enregistrer une prise de contact"
          >
            Prise de contact
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ds-text)]">Relances entreprises</h1>
          <p className="text-sm text-[var(--ds-text-subtle)] mt-0.5">
            {bulkMode ? 'Mode groupé : sélectionne les entreprises et choisis un modèle de mail' : 'Prépare les brouillons de relance — le mail part dans tes brouillons Gmail, à toi de l\'envoyer'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={bulkMode ? 'primary' : 'secondary'}
            leftIcon={<IconSend className="h-3.5 w-3.5" />}
            onClick={() => { setBulkMode(!bulkMode); setBulkResult(null); setBulkError(null) }}
          >
            {bulkMode ? 'Mode individuel' : 'Relance groupée'}
          </Button>
          <select
            value={ownerId ?? ''}
            onChange={(e) => setOwnerId(e.target.value === '' ? null : Number(e.target.value))}
            className={`${FIELD} cursor-pointer`}
            title="Filtrer par commercial"
          >
            <option value="">Tous les commerciaux</option>
            {salePersons.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.firstName} {sp.lastName}
              </option>
            ))}
          </select>

          <select
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value as DateMode)}
            className={`${FIELD} cursor-pointer`}
            title="Filtrer par date de relance"
          >
            <option value="all">Toutes les dates</option>
            <option value="days">Prochains jours</option>
            <option value="exact">Date précise</option>
            <option value="range">Période</option>
          </select>

          {dateMode === 'days' && (
            <label className="flex items-center gap-2 text-sm text-[var(--ds-text-subtle)]">
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 1)}
                className={`${FIELD} w-20`}
              />
              jours
            </label>
          )}

          {dateMode === 'exact' && (
            <input type="date" value={exactDate} onChange={(e) => setExactDate(e.target.value)} className={FIELD} />
          )}

          {dateMode === 'range' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} title="Du" />
              <span className="text-sm text-[var(--ds-text-subtle)]">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} title="Au" />
            </>
          )}
        </div>
      </div>

      {bulkMode && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-template" className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide">
              Modèle de mail
            </label>
            <select
              id="bulk-template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-3 text-sm text-[var(--ds-text)] outline-none focus:border-purple transition-colors"
            >
              <option value="">— Choisir un modèle —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {template && (
            <div className="rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-4 py-3 text-sm text-[var(--ds-text-muted)]">
              <span className="text-xs text-[var(--ds-text-subtle)]">
                Objet : <strong className="text-[var(--ds-text-muted)]">{template.subject}</strong>
                {template.attachment ? ` · PJ : ${template.attachment.filename}` : ''}
              </span>
              <div
                className="prose prose-sm max-w-none text-[var(--ds-text-muted)] line-clamp-4 mt-1"
                dangerouslySetInnerHTML={{ __html: cleanHtml(template.body) }}
              />
            </div>
          )}
          {bulkResult && (
            <div className="rounded-xl border border-green-100 bg-[var(--ds-success-bg)] px-5 py-3 flex items-center gap-2 text-sm text-[var(--ds-success)]">
              <IconCheckCircle width={16} height={16} />
              <span>{bulkResult.message}</span>
            </div>
          )}
          {bulkError && (
            <div className="rounded-xl border border-[var(--ds-danger)] bg-[var(--ds-danger-bg)] px-5 py-3 text-sm text-[var(--ds-danger)]">{bulkError}</div>
          )}
        </div>
      )}

      {loading && companies.length === 0 ? (
        <p className="text-sm text-[var(--ds-text-subtle)]">Chargement...</p>
      ) : (
        <>
          {bulkMode ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--ds-text-muted)]">Mode d'envoi</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setSendMode('all')}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    sendMode === 'all'
                      ? 'border-purple bg-purple-light/10 ring-2 ring-purple/20'
                      : 'border-[var(--ds-border)] hover:border-[var(--ds-border)]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--ds-text)]">Toutes les entreprises</p>
                  <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">
                    Envoyer le mail à l'intégralité des {companies.length} entreprises de la base
                  </p>
                </button>
                <button
                  onClick={() => setSendMode('specific')}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    sendMode === 'specific'
                      ? 'border-purple bg-purple-light/10 ring-2 ring-purple/20'
                      : 'border-[var(--ds-border)] hover:border-[var(--ds-border)]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--ds-text)]">Entreprises spécifiques</p>
                  <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">
                    Rechercher et sélectionner des entreprises une par une
                  </p>
                </button>
              </div>

              {sendMode === 'specific' && (
                <div className="flex flex-col gap-3 mt-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher une entreprise par nom, email ou SIRET..."
                      className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-3 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none focus:border-purple transition-colors"
                    />
                    {searchTerm && filteredSearch.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-lg max-h-60 overflow-y-auto">
                        {filteredSearch.slice(0, 20).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => addCompany(c)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-light/20 transition-colors border-b border-[var(--ds-border)] last:border-b-0"
                          >
                            <span className="font-medium text-[var(--ds-text)]">{c.nom_commercial ?? 'Sans nom'}</span>
                            <span className="text-[var(--ds-text-subtle)] ml-2">{c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchTerm && filteredSearch.length === 0 && (
                      <p className="text-xs text-[var(--ds-text-subtle)] mt-1">Aucune entreprise trouvée</p>
                    )}
                  </div>

                  {manuallySelected.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {manuallySelected.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-purple-light/30 px-3 py-1.5 text-xs font-medium text-purple"
                        >
                          <IconCompany width={12} height={12} />
                          {c.nom_commercial ?? 'Sans nom'}
                          <button onClick={() => removeCompany(c.id)} className="hover:text-[var(--ds-danger)] transition-colors ml-1">
                            <IconErrorCircle width={14} height={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-[var(--ds-text-subtle)]">
                    {manuallySelected.length > 0
                      ? `${manuallySelected.length} entreprise${manuallySelected.length > 1 ? 's' : ''} sélectionnée${manuallySelected.length > 1 ? 's' : ''}`
                      : 'Aucune entreprise sélectionnée'}
                  </p>
                </div>
              )}

              {sendMode === 'all' && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="rounded-xl bg-[var(--ds-warning-bg)] border border-amber-100 px-4 py-3 text-sm text-[var(--ds-warning)]">
                    <p className="font-medium">Attention</p>
                    <p className="text-xs mt-0.5">
                      Le mail sera envoyé à toutes les entreprises disposant d'une adresse email dans la base ({companies.filter((c) => c.email).length} entreprises). L'envoi peut prendre plusieurs minutes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* À relancer */}
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-[var(--ds-text-muted)] uppercase tracking-widest flex items-center gap-2">
                  <IconBell className="h-4 w-4 text-[var(--ds-danger)]" />
                  À relancer ({due.length})
                </h2>
                {due.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--ds-border)] py-10 text-center text-sm text-[var(--ds-text-subtle)]">
                    Aucune relance en retard 🎉
                  </div>
                ) : (
                  groupByType(due).map((group) => (
                    <TypeGroup key={group.typeId ?? 'none'} typeId={group.typeId} count={group.items.length}>
                      {group.items.map((ent) => <Row key={ent.id} ent={ent} isDue />)}
                    </TypeGroup>
                  ))
                )}
              </section>

              {/* À venir */}
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-[var(--ds-text-muted)] uppercase tracking-widest flex items-center gap-2">
                  <IconSchedule className="h-4 w-4 text-blue" />
                  À venir ({upcoming.length})
                </h2>
                {upcoming.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--ds-border)] py-10 text-center text-sm text-[var(--ds-text-subtle)]">
                    Aucune relance planifiée
                  </div>
                ) : (
                  groupByType(upcoming).map((group) => (
                    <TypeGroup key={group.typeId ?? 'none'} typeId={group.typeId} count={group.items.length}>
                      {group.items.map((ent) => <Row key={ent.id} ent={ent} isDue={false} />)}
                    </TypeGroup>
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}

      {mailFor && (
        <MailModal
          defaultTo={mailFor.email ?? ''}
          candidateName={mailFor.nom_commercial ?? undefined}
          scope="commercial"
          defaultTemplateId={mailFor.relance_template_id ?? undefined}
          sendLabel="Envoyer la relance"
          successLabel="Relance envoyée"
          onCustomSend={(mail) => sendMailRelance(mailFor, mail)}
          onClose={() => setMailFor(null)}
        />
      )}

      {contactFor && (
        <ContactLogModal
          entreprise={contactFor}
          onSuccess={(applied) => onContactSuccess(contactFor, applied)}
          onClose={() => setContactFor(null)}
        />
      )}

      {bulkMode && (
        <div className="sticky bottom-4 z-30 ds-glass-strong rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="text-sm text-[var(--ds-text-subtle)]">
              {sendMode === 'all' ? (
                <>
                  Envoi à <strong className="text-[var(--ds-text)]">toutes les entreprises</strong> ({companies.filter((c) => !!c.email).length} avec email)
                </>
              ) : manuallySelected.length > 0 ? (
                <>
                  <strong className="text-[var(--ds-text)]">{manuallySelected.length}</strong> entreprise
                  {manuallySelected.length > 1 ? 's' : ''} sélectionnée{manuallySelected.length > 1 ? 's' : ''}
                </>
              ) : (
                'Aucune entreprise sélectionnée'
              )}
            </span>
            <Button
              leftIcon={<IconSend width={16} height={16} />}
              disabled={!canSend || !selectedTemplateId}
              isLoading={sending}
              onClick={handleBulkSend}
            >
              {sendMode === 'all' ? 'Envoyer à toutes les entreprises' : `Lancer la relance (${manuallySelected.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
