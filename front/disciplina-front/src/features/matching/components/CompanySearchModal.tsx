import { useState, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, Search, Plus } from 'lucide-react'
import { useQuery } from 'urql'
import { GET_SALE_PERSONS } from '@/graphql/queries'
import { useCompanies, useCreateCompany } from '@/graphql/hooks'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { apiFetch } from '@/api/httpClient'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import type { AppUser } from '@/store/authStore'
import type { Entreprise } from '@/types/entreprise'
import type { SireneEtablissement } from '@/types/sourcing'

interface CheckSiretResult extends SireneEtablissement {
  alreadyExists: boolean
  isBlacklisted: boolean
  blacklistReason: string | null
}

export function CompanySearchModal({ open, onClose, currentUser }: { open: boolean; onClose: () => void; currentUser: AppUser | null }) {
  const [mode, setMode] = useState<'search' | 'siret'>('search')
  const [query, setQuery] = useState('')
  const [siret, setSiret] = useState('')
  const [siretData, setSiretData] = useState<CheckSiretResult | null>(null)
  const [siretStatus, setSiretStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [siretError, setSiretError] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [abCompany, setAbCompany] = useState<Entreprise | null>(null)
  const [creating, setCreating] = useState(false)

  useCompanies()
  const { createCompany } = useCreateCompany()
  const companies = usePortefeuilleStore((s) => s.companies)
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

  const findAutoOwner = useCallback((siren: string) => {
    const match = companies.find((c) => c.siret?.startsWith(siren) && c.proprietaire_id != null)
    return match?.proprietaire_id ?? null
  }, [companies])

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
      const ownerId = findAutoOwner(data.siren)
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
        onSuccess={() => { setAbCompany(null); onClose() }}
      />
    )
  }

  if (mode === 'siret') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setMode('search'); onClose() }}>
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Nouvelle entreprise</h3>

            <div>
              <input
                type="text"
                value={siret}
                onChange={(e) => { setSiret(e.target.value.replace(/\D/g, '').slice(0, 14)); setSiretStatus('idle') }}
                placeholder="SIRET (14 chiffres)"
                maxLength={14}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSiretLookup() }}
              />
              <button
                onClick={handleSiretLookup}
                disabled={siret.length !== 14 || siretStatus === 'loading'}
                className="mt-2 w-full rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-40"
              >
                {siretStatus === 'loading' ? (
                  <><Loader2 size={14} className="inline animate-spin mr-1" /> Vérification…</>
                ) : 'Vérifier le SIRET'}
              </button>
            </div>

            {siretStatus === 'error' && (
              <div className="rounded-lg bg-danger-bg p-3 text-xs text-danger flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{siretError}</span>
                {siretError.includes('existe déjà') && (
                  <button onClick={() => setMode('search')} className="shrink-0 font-medium underline whitespace-nowrap">
                    Rechercher
                  </button>
                )}
              </div>
            )}

            {siretStatus === 'success' && siretData && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {siretData.denomination || siretData.nomPrenom || 'Entreprise sans nom'}
                  </p>
                  {siretData.adresse && (
                    <p className="text-xs text-gray-500">
                      {[siretData.adresse.numeroVoie, siretData.adresse.typeVoie, siretData.adresse.libelleVoie].filter(Boolean).join(' ')}
                      {siretData.adresse.codePostal && `, ${siretData.adresse.codePostal}`}
                      {siretData.adresse.commune && ` ${siretData.adresse.commune}`}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">SIRET : {siretData.siret}</p>
                  <p className="text-xs text-gray-400">SIREN : {siretData.siren}</p>
                </div>

                {salePersons.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Propriétaire du contact</label>
                    <select
                      value={selectedOwnerId ?? ''}
                      onChange={(e) => setSelectedOwnerId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
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
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
                  >
                    Modifier le SIRET
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue/90 disabled:opacity-40"
                  >
                    {creating && <Loader2 size={14} className="animate-spin" />}
                    {creating ? 'Création…' : "Créer l'entreprise"}
                  </button>
                </div>
              </div>
            )}

            {siretStatus !== 'success' && (
              <div className="flex justify-end">
                <button
                  onClick={() => setMode('search')}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Ajouter une entreprise</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
              autoFocus
            />
          </div>
          <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border border-gray-100">
            {companies
              .filter((c) => c.nom_commercial?.toLowerCase().includes(query.toLowerCase()))
              .map((c) => (
                <li
                  key={c.id}
                  onClick={() => setAbCompany(c)}
                  className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm transition hover:bg-blue-50"
                >
                  <span className="font-medium text-gray-900">{c.nom_commercial}</span>
                  {c.siret && <span className="text-xs text-gray-400">{c.siret}</span>}
                </li>
              ))}
            {companies.filter((c) => c.nom_commercial?.toLowerCase().includes(query.toLowerCase())).length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-gray-400">Aucune entreprise trouvée</li>
            )}
          </ul>
          <button
            onClick={() => { setMode('siret'); setSiret(''); setSiretStatus('idle'); setSiretError(''); setSiretData(null) }}
            className="flex items-center gap-2 text-sm font-medium text-blue transition hover:text-blue/80"
          >
            <Plus size={14} />
            Créer une nouvelle entreprise
          </button>
        </div>
      </div>
    </div>
  )
}
