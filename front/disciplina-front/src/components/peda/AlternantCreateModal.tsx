import { useEffect, useMemo, useState } from 'react'
import { IconAlert, IconCheck, IconClose, IconLink, IconSearch, IconUnlink, IconUser } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { createAlternant, checkAlternantEmail, fetchAlternants, lookupCandidateByEmail, updateAlternant } from '@/api/alternants'
import type { Alternant } from '@/types/alternant'

interface AlternantCreateModalProps {
  /** Mode édition (bouton Modifier de la fiche) : seule l'identité est éditable. */
  initial?: Alternant
  onClose: () => void
  onCreated?: (id: string) => void
  onSaved?: (alternant: Alternant) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">{children}</h3>
  )
}

export default function AlternantCreateModal({ initial, onClose, onCreated, onSaved }: AlternantCreateModalProps) {
  const isEdit = Boolean(initial)
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [session, setSession] = useState(initial?.session ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [candidateId, setCandidateId] = useState<string | null>(initial?.candidateId ?? null)

  const [companyName, setCompanyName] = useState(initial?.company?.name ?? '')
  const [companyAddress, setCompanyAddress] = useState(initial?.company?.address ?? '')
  const [mentorName, setMentorName] = useState(initial?.company?.mentorName ?? '')
  const [startDate, setStartDate] = useState(
    initial?.company?.startDate ? initial.company.startDate.slice(0, 10) : '',
  )
  const [endDate, setEndDate] = useState(initial?.company?.endDate ? (initial.company.endDate as string).slice(0, 10) : '')

  const [linkedIds, setLinkedIds] = useState<string[]>(initial?.linkedAlternantIds ?? [])
  const [allAlternants, setAllAlternants] = useState<Alternant[]>([])
  const [linkSearch, setLinkSearch] = useState('')

  const [candidateEmail, setCandidateEmail] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailDup, setEmailDup] = useState<{ fullName: string } | null>(null)

  // Contrôle de doublon en direct sur l'email (alternants existants).
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = email.trim()
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailDup(null)
        return
      }
      // En édition, l'email inchangé n'est pas un doublon.
      if (isEdit && trimmed.toLowerCase() === (initial?.email ?? '').trim().toLowerCase()) {
        setEmailDup(null)
        return
      }
      checkAlternantEmail(trimmed).then(
        (hit) => setEmailDup(hit?.exists ? { fullName: hit.fullName ?? 'cet alternant' } : null),
        () => setEmailDup(null),
      )
    }, 400)
    return () => clearTimeout(t)
  }, [email, isEdit, initial?.email])

  // Liste complète des alternants pour le suivi en commun (hors fiche éditée).
  useEffect(() => {
    if (isEdit) return
    fetchAlternants().then(setAllAlternants).catch(() => {})
  }, [isEdit])

  const filteredAlternants = useMemo(() => {
    const q = linkSearch.trim().toLowerCase()
    return allAlternants
      .filter((a) => a.id !== initial?.id)
      .filter((a) =>
        q ? `${a.firstName} ${a.lastName} ${a.session} ${a.company?.name ?? ''}`.toLowerCase().includes(q) : true,
      )
  }, [allAlternants, linkSearch, initial?.id])

  function toggleLink(id: string) {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleLookupCandidate() {
    const mail = candidateEmail.trim()
    if (!mail) return
    setLookingUp(true)
    setLookupMsg(null)
    try {
      const hit = await lookupCandidateByEmail(mail)
      if (!hit) {
        setLookupMsg('Aucune fiche candidat pour cet email — saisie manuelle.')
        return
      }
      setFirstName(hit.firstName)
      setLastName(hit.lastName)
      setEmail(hit.email)
      setPhone(hit.phone)
      setCandidateId(hit.candidateId)
      setLookupMsg(`Identité récupérée depuis la fiche candidat (${hit.firstName} ${hit.lastName}).`)
    } catch (e) {
      setLookupMsg(e instanceof Error ? e.message : 'Recherche impossible')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e?: { preventDefault: () => void }) {
    e?.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }
    if (!session.trim()) {
      setError('La session est obligatoire.')
      return
    }
    if (!isEdit && !startDate) {
      setError('La date d’entrée en entreprise est obligatoire.')
      return
    }
    if (!isEdit && endDate && endDate < startDate) {
      setError('La date de fin doit être postérieure à la date d’entrée.')
      return
    }
    if (emailDup) {
      setError(`Un alternant existe déjà avec cet email (${emailDup.fullName}).`)
      return
    }

    setLoading(true)
    try {
      if (isEdit && initial) {
        const updated = await updateAlternant(initial.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          session: session.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        if (!updated) throw new Error('Mise à jour échouée')
        onSaved?.(updated)
        onClose()
        return
      }
      const created = await createAlternant({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        session: session.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        candidateId,
        company: {
          name: companyName.trim() || null,
          address: companyAddress.trim() || null,
          mentorName: mentorName.trim() || null,
          startDate,
          endDate: endDate || null,
        },
        linkedAlternantIds: linkedIds,
      })
      onCreated?.(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconUser width={20} height={20} className="text-teal-700" />
            {isEdit ? 'Modifier l’alternant' : 'Nouvel alternant'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Identité */}
          <section className="space-y-4">
            <SectionTitle>Identité</SectionTitle>
            {!isEdit && (
              <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <InputField
                      id="alt-candidate-email"
                      label="Récupérer depuis une fiche candidat"
                      type="email"
                      placeholder="Email du candidat…"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      hint="Pré-remplit prénom, nom, email et téléphone."
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLookupCandidate}
                    isLoading={lookingUp}
                    className="shrink-0"
                  >
                    Récupérer
                  </Button>
                </div>
                {lookupMsg && (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)]">
                    <IconCheck width={14} height={14} className="shrink-0 text-teal-700" />
                    {lookupMsg}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="alt-firstname"
                label="Prénom"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex : Léa"
              />
              <InputField
                id="alt-lastname"
                label="Nom"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex : Martin"
              />
            </div>
            <InputField
              id="alt-session"
              label="Session"
              required
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="Ex : SIO-2026 (groupes Sessions à venir)"
              hint="Champ libre pour l’instant — remplacé par les groupes Sessions."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <InputField
                  id="alt-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lea.martin@exemple.fr"
                  error={emailDup ? `Un alternant existe déjà avec cet email (${emailDup.fullName}).` : undefined}
                />
              </div>
              <InputField
                id="alt-phone"
                label="Téléphone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0692…"
              />
            </div>
          </section>

          {/* Entreprise */}
          {!isEdit && (
            <section className="space-y-4 border-t border-[var(--ds-border)] pt-5">
              <SectionTitle>Entreprise</SectionTitle>
              <InputField
                id="alt-company-name"
                label="Nom de l’entreprise"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex : Acme SARL"
              />
              <InputField
                id="alt-company-address"
                label="Adresse de l’entreprise"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="12 rue des Palmiers, Saint-Denis"
              />
              <InputField
                id="alt-mentor"
                label="Maître d’apprentissage"
                value={mentorName}
                onChange={(e) => setMentorName(e.target.value)}
                placeholder="Nom du maître d’apprentissage"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                  id="alt-start-date"
                  label="Date d’entrée en entreprise"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <InputField
                  id="alt-end-date"
                  label="Date de fin en entreprise"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </section>
          )}

          {/* Jeunes liés */}
          {!isEdit && (
            <section className="space-y-3 border-t border-[var(--ds-border)] pt-5">
              <SectionTitle>Jeunes liés (suivi en commun)</SectionTitle>
              <p className="text-[13px] text-[var(--ds-text-subtle)]">
                Un rappel s’affichera sur les SA à venir pour penser à faire leurs séquences en même temps.
              </p>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                  <IconSearch width={16} height={16} />
                </span>
                <input
                  type="search"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Rechercher un alternant…"
                  aria-label="Rechercher un alternant à lier"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--ds-accent)]"
                />
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--ds-border)] p-2">
                {filteredAlternants.length === 0 && (
                  <li className="px-3 py-4 text-center text-[13px] text-[var(--ds-text-subtle)]">
                    {allAlternants.length === 0 ? 'Aucun autre alternant pour l’instant.' : 'Aucun résultat.'}
                  </li>
                )}
                {filteredAlternants.map((a) => {
                  const linked = linkedIds.includes(a.id)
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => toggleLink(a.id)}
                        aria-pressed={linked}
                        className={[
                          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          linked
                            ? 'bg-teal-700/10 ring-1 ring-inset ring-teal-700/30'
                            : 'hover:bg-[var(--ds-surface-sunken)]',
                        ].join(' ')}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--ds-text)]">{a.fullName}</span>
                          <span className="block truncate text-[12px] text-[var(--ds-text-subtle)]">
                            {a.session}{a.company?.name ? ` · ${a.company.name}` : ''}
                          </span>
                        </span>
                        <span
                          className={[
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold',
                            linked ? 'bg-teal-700 text-white' : 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]',
                          ].join(' ')}
                        >
                          {linked ? <IconLink width={13} height={13} /> : <IconUnlink width={13} height={13} />}
                          {linked ? 'Lié' : 'Lier'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
              <IconAlert width={16} height={16} className="shrink-0" />
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading} loadingLabel="Enregistrement">
            {isEdit ? 'Enregistrer' : 'Créer l’alternant'}
          </Button>
        </div>
      </div>
    </div>
  )
}
