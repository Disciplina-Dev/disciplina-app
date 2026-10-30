import { useState, useCallback, useEffect } from 'react'
import { IconAlert, IconLoader, IconPlus, IconSearch } from '@/components/ui/icons'
import { useClient, useQuery } from 'urql'
import { GET_COMPANIES, GET_SALE_PERSONS } from '@/graphql/queries'
import { useCreateCompany } from '@/graphql/hooks'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { toEntrepriseFromCompanyWithSalePerson } from '@/types/companyMapper'
import { apiFetch } from '@/api/httpClient'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import type { AppUser } from '@/store/authStore'
import type { Entreprise, CompanyWithSalePerson } from '@/types/entreprise'
import type { SireneEtablissement } from '@/types/sourcing'

interface CheckSiretResult extends SireneEtablissement {
  alreadyExists: boolean
  isBlacklisted: boolean
  blacklistReason: string | null
}

export function CompanySearchModal({ open, onClose, currentUser, onSuccess }: { open: boolean; onClose: () => void; currentUser: AppUser | null; onSuccess?: (needsAnalysisId: string) => void }) {
  const [mode, setMode] = useState<'search' | 'siret'>('search')
  const [query, setQuery] = useState('')
  const [siret, setSiret] = useState('')
  const [siretData, setSiretData] = useState<CheckSiretResult | null>(null)
  const [siretStatus, setSiretStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [siretError, setSiretError] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [abCompany, setAbCompany] = useState<Entreprise | null>(null)
  const [creating, setCreating] = useState(false)

  const client = useClient()
  const { createCompany } = useCreateCompany()
  const salePersons = usePortefeuilleStore((s) => s.salePersons)
  const setSalePersons = usePortefeuilleStore((s) => s.setSalePersons)
  const [spResult] = useQuery({ query: GET_SALE_PERSONS, pause: salePersons.length > 0 })
  useEffect(() => {
    if (spResult.data?.salePersons) {
      setSalePersons(spResult.data.salePersons)
    }
  }, [spResult.data, setSalePersons])

  useEffect(() => {
    if (open) {
      setMode('search'); setQuery(''); setSiret('')
      setSiretData(null); setSiretStatus('idle'); setSiretError('')
      setSelectedOwnerId(null); setAbCompany(null); setCreating(false)
    }
  }, [open])

  // Recherche serveur (nom + SIRET) : le portefeuille n'est plus chargé en
  // entier dans le store pour cette modale.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const searchTerm = debouncedQuery.trim()
  const searchActive = searchTerm.length >= 2
  const [searchResult] = useQuery({
    query: GET_COMPANIES,
    variables: { search: searchTerm, first: 20 },
    pause: !searchActive || !open,
    requestPolicy: 'network-only',
  })
  const searchEdges: { node: CompanyWithSalePerson }[] = searchResult.data?.companies?.edges ?? []
  const searchCompanies: Entreprise[] = searchEdges.map(({ node }) =>
    toEntrepriseFromCompanyWithSalePerson(node),
  )
  const searchSettled = searchActive && !searchResult.fetching

  // Propriétaire automatique : même SIREN déjà au portefeuille. Le serveur
  // cherche par SIREN (préfixe des SIRET) car `companiesBySiren` n'expose pas
  // de filtre par SIREN.
  const findAutoOwner = useCallback(async (siren: string) => {
    const result = await client
      .query(GET_COMPANIES, { search: siren, first: 20 }, { requestPolicy: 'network-only' })
      .toPromise()
    const ownedEdges: { node: CompanyWithSalePerson }[] = result.data?.companies?.edges ?? []
    const owned = ownedEdges.find(({ node }) => node.salePerson?.id != null)
    return owned?.node.salePerson?.id ?? null
  }, [client])

  const handleSiretLookup = useCallback(async () => {
    if (!/^\d{14}$/.test(siret)) {
      setSiretError('Le SIRET doit contenir exactement 14 chiffres'); setSiretStatus('error')
      return
    }
    setSiretStatus('loading'); setSiretError('')
    try {
      const res = await apiFetch(`/api/sourcing/${siret}`)
      if (res.status === 404) {
        setSiretError('SIRET introuvable dans le registre INSEE'); setSiretStatus('error')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur lors de la recherche' }))
        setSiretError(err.error || 'Erreur lors de la recherche'); setSiretStatus('error')
        return
      }
      const data = await res.json()
      if (data.alreadyExists) {
        setSiretError('Cette entreprise existe déjà dans le portefeuille'); setSiretStatus('error')
        return
      }
      if (data.isBlacklisted) {
        setSiretError(`Cette entreprise est blacklistée${data.blacklistReason ? ` : ${data.blacklistReason}` : ''}`)
        setSiretStatus('error')
        return
      }
      setSiretData(data); setSiretStatus('success')
      const ownerId = await findAutoOwner(data.siren)
      setSelectedOwnerId(ownerId ?? (currentUser?.id ? Number(currentUser.id) : null))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la recherche'
      setSiretError(msg); setSiretStatus('error')
    }
  }, [siret, findAutoOwner, currentUser])

  const handleCreate = useCallback(async () => {
    if (!siretData) return
    setCreating(true)
    try {
      const name = siretData.denomination || siretData.nomPrenom || 'Entreprise sans nom'
      const address = [siretData.adresse.numeroVoie, siretData.adresse.typeVoie, siretData.adresse.libelleVoie].filter(Boolean).join(' ')
      const res = await createCompany({
        name: name.trim(),
        siret: siretData.siret,
        userID: selectedOwnerId,
        address: address || undefined,
      })
      if (res.data?.createCompany) {
        setAbCompany({
          id: String(res.data.createCompany.id),
          nom_commercial: res.data.createCompany.name,
          proprietaire_contact: null,
          commercial: null,
          proprietaire_id: res.data.createCompany.userID ?? null,
          representant_legal: null,
          telephone: res.data.createCompany.phone,
          email: res.data.createCompany.email,
          adresse: res.data.createCompany.address,
          secteur: res.data.createCompany.sector,
          metier: res.data.createCompany.mainActivity,
          siret: res.data.createCompany.siret,
          idcc: res.data.createCompany.idcc,
          note: res.data.createCompany.notes,
          conclusion: res.data.createCompany.conclusion,
          status: (res.data.createCompany.status as Entreprise['status']) || 'À Réfléchir',
          date_insertion: null,
          date_relance: null,
          type_relance: null,
          relance_template_id: null,
          relance_channel: null,
        })
      }
    } finally {
      setCreating(false)
    }
  }, [siretData, createCompany, selectedOwnerId])

  if (!open) return null

  if (abCompany) {
    return (
      <NeedsAnalysisModal
        entreprise={abCompany}
        currentUser={currentUser!}
        onClose={() => { setAbCompany(null); onClose() }}
        onSuccess={(needsAnalysisId) => { setAbCompany(null); onSuccess?.(needsAnalysisId); onClose() }}
      />
    )
  }

  if (mode === 'siret') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setMode('search'); onClose() }}>
        <div className="w-full max-w-md rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--ds-text)]">Nouvelle entreprise</h3>

            <div>
              <input
                type="text"
                name="siret-lookup"
                value={siret}
                onChange={(e) => { setSiret(e.target.value.replace(/\D/g, '').slice(0, 14)); setSiretStatus('idle') }}
                placeholder="SIRET (14 chiffres)"
                maxLength={14}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSiretLookup() }}
              />
              <button
                onClick={handleSiretLookup}
                disabled={siret.length !== 14 || siretStatus === 'loading'}
                className="mt-2 w-full rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-40"
              >
                {siretStatus === 'loading' ? (
                  <><IconLoader width={14} height={14} className="inline animate-spin mr-1" /> Vérification…</>
                ) : 'Vérifier le SIRET'}
              </button>
            </div>

            {siretStatus === 'error' && (
              <div className="rounded-lg bg-[var(--ds-danger-bg)] p-3 text-xs text-[var(--ds-danger)] flex items-start gap-2">
                <IconAlert width={14} height={14} className="shrink-0 mt-0.5" />
                <span>{siretError}</span>
                {siretError.includes('existe déjà') && (
                  <button
                    onClick={() => { setMode('search'); setQuery(siret) }}
                    className="shrink-0 font-medium underline whitespace-nowrap"
                  >
                    Rechercher
                  </button>
                )}
              </div>
            )}

            {siretStatus === 'success' && siretData && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-[var(--ds-text)]">
                    {siretData.denomination || siretData.nomPrenom || 'Entreprise sans nom'}
                  </p>
                  {siretData.adresse && (
                    <p className="text-xs text-[var(--ds-text-subtle)]">
                      {[siretData.adresse.numeroVoie, siretData.adresse.typeVoie, siretData.adresse.libelleVoie].filter(Boolean).join(' ')}
                      {siretData.adresse.codePostal && `, ${siretData.adresse.codePostal}`}
                      {siretData.adresse.commune && ` ${siretData.adresse.commune}`}
                    </p>
                  )}
                  <p className="text-xs text-[var(--ds-text-subtle)]">SIRET : {siretData.siret}</p>
                  <p className="text-xs text-[var(--ds-text-subtle)]">SIREN : {siretData.siren}</p>
                </div>

                {salePersons.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--ds-text-muted)]">Propriétaire du contact</label>
                    <select
                      value={selectedOwnerId ?? ''}
                      onChange={(e) => setSelectedOwnerId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
                    >
                      <option value="">Sélectionner un commercial</option>
                      {salePersons.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.firstName} {sp.lastName} ({sp.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setMode('siret')}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)]"
                  >
                    Modifier le SIRET
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue/90 disabled:opacity-40"
                  >
                    {creating && <IconLoader width={14} height={14} className="animate-spin" />}
                    {creating ? 'Création…' : "Créer l'entreprise"}
                  </button>
                </div>
              </div>
            )}

            {siretStatus !== 'success' && (
              <div className="flex justify-end">
                <button
                  onClick={() => setMode('search')}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)]"
                >
                  Retour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--ds-text)]">Ajouter une entreprise</h3>
          <div className="relative">
            <IconSearch width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)]" />
            <input
              type="text"
              name="company-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom ou SIRET..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-lg border border-[var(--ds-border)] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
              autoFocus
            />
          </div>
          <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border border-[var(--ds-border)]">
            {searchActive && searchResult.fetching && (
              <li className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-[var(--ds-text-subtle)]">
                <IconLoader width={14} height={14} className="animate-spin" /> Recherche…
              </li>
            )}
            {searchCompanies.map((c) => (
              <li
                key={c.id}
                onClick={() => setAbCompany(c)}
                className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm transition hover:bg-[var(--ds-accent-soft)]"
              >
                <span className="font-medium text-[var(--ds-text)]">{c.nom_commercial}</span>
                {c.siret && <span className="text-xs text-[var(--ds-text-subtle)]">{c.siret}</span>}
              </li>
            ))}
            {searchSettled && searchResult.error && (
              <li className="px-3 py-4 text-center text-xs text-[var(--ds-danger)]">
                Erreur lors de la recherche : {searchResult.error.message}
              </li>
            )}
            {searchSettled && !searchResult.error && searchCompanies.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-[var(--ds-text-subtle)]">Aucune entreprise trouvée</li>
            )}
            {!searchActive && (
              <li className="px-3 py-4 text-center text-xs text-[var(--ds-text-subtle)]">
                Saisissez au moins 2 caractères pour lancer la recherche.
              </li>
            )}
          </ul>
          <button
            onClick={() => { setMode('siret'); setSiret(''); setSiretStatus('idle'); setSiretError(''); setSiretData(null) }}
            className="flex items-center gap-2 text-sm font-medium text-blue transition hover:text-blue/80"
          >
            <IconPlus width={14} height={14} />
            Créer une nouvelle entreprise
          </button>
        </div>
      </div>
    </div>
  )
}
