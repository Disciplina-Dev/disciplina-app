import { useEffect, useState } from 'react'
import { X, Loader2, MessageSquare, Search } from 'lucide-react'
import type { EntrepriseConflit } from '@/types/entreprise'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useSalePersons, useUpdateCompanyConflict, useResolveCompanyConflict } from '@/graphql/hooks'
import { apiJson } from '@/api/httpClient'
import { normalizeSiret, displayName as sireneDisplayName, displayAddress, type SireneEtablissement } from '@/types/sourcing'
import { conflictLabel, getConflictTypeConfig } from '../conflictTypes'

interface Props {
  entreprise: EntrepriseConflit
  onClose: () => void
}

interface ResolverForm {
  name: string
  siret: string
  phone: string
  email: string
  address: string
  idcc: string
  ape: string
  userId: string
}

function toForm(entreprise: EntrepriseConflit): ResolverForm {
  return {
    name: entreprise.nom_commercial ?? '',
    siret: entreprise.siret ?? '',
    phone: entreprise.telephone ?? '',
    email: entreprise.email ?? '',
    address: entreprise.adresse ?? '',
    idcc: entreprise.idcc ?? '',
    ape: '',
    userId: entreprise.proprietaire_id ? String(entreprise.proprietaire_id) : '',
  }
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue'

export default function ConflictResolverModal({ entreprise, onClose }: Props) {
  const salePersons = usePortefeuilleStore((s) => s.salePersons)
  useSalePersons()
  const { updateCompanyConflict, result: updateResult } = useUpdateCompanyConflict()
  const { resolveCompanyConflict, result: resolveResult } = useResolveCompanyConflict()

  const [form, setForm] = useState<ResolverForm>(() => toForm(entreprise))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sourcingLoading, setSourcingLoading] = useState(false)
  const [sourcingError, setSourcingError] = useState<string | null>(null)

  const config = getConflictTypeConfig(entreprise.conclusion)

  const candidateIds = entreprise.candidateUserIds
  const commercialOptions = candidateIds?.length
    ? salePersons.filter((sp) => candidateIds.includes(Number(sp.id)))
    : salePersons

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    setError(null)

    if (config.requiresCommercial && !form.userId) {
      setError('Sélectionnez un commercial avant de résoudre ce conflit.')
      return
    }

    setSubmitting(true)
    try {
      const updateResponse = await updateCompanyConflict(Number(entreprise.id), {
        name: form.name || null,
        siret: form.siret || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        idcc: form.idcc || null,
        ape: form.ape || null,
        ...(config.requiresCommercial ? { userId: Number(form.userId) } : {}),
      })
      if (updateResponse.error) {
        setError(updateResponse.error.message)
        return
      }

      const resolveResponse = await resolveCompanyConflict(Number(entreprise.id))
      if (resolveResponse.error) {
        setError(resolveResponse.error.message)
        return
      }

      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleFetchSourcing = async () => {
    const digits = normalizeSiret(form.siret)
    setSourcingError(null)
    setSourcingLoading(true)
    try {
      const data = await apiJson<
        SireneEtablissement & { isBlacklisted: boolean; blacklistReason: string | null }
      >(`/api/sourcing/${digits}`)
      setForm((f) => ({ ...f, name: sireneDisplayName(data), address: displayAddress(data.adresse) }))
      if (data.isBlacklisted) {
        setSourcingError(`Attention : entreprise blacklistée (${data.blacklistReason ?? 'raison inconnue'}).`)
      }
    } catch (err: any) {
      setSourcingError(err?.message || 'Impossible de récupérer les informations Sirene.')
    } finally {
      setSourcingLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl mx-4 sm:mx-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {conflictLabel(entreprise.conclusion)}
            </p>
            <h3 className="text-[16px] font-bold text-gray-900">Résoudre le conflit</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {entreprise.note?.trim() && (
          <div className="mx-5 mt-4 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3">
            <div className="flex gap-2.5">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-300 mt-[1px]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Détail du conflit
                </p>
                <p className="text-[13px] leading-relaxed text-gray-600 whitespace-pre-wrap">{entreprise.note}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-4 space-y-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nom de l'entreprise"
            className={inputClass}
          />

          {config.siretEditable ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={form.siret}
                  onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))}
                  placeholder="SIRET (14 chiffres)"
                  className={`${inputClass} font-mono`}
                />
                <button
                  type="button"
                  onClick={handleFetchSourcing}
                  disabled={sourcingLoading || normalizeSiret(form.siret).length !== 14}
                  title="Récupérer les infos via le SIRET"
                  className="shrink-0 flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sourcingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </button>
              </div>
              {sourcingError && <p className="text-[11px] text-danger">{sourcingError}</p>}
            </div>
          ) : form.siret ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[13px] font-mono text-gray-500">
              {form.siret}
            </div>
          ) : null}

          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Téléphone"
            className={inputClass}
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className={inputClass}
          />
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Adresse"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={form.idcc}
              onChange={(e) => setForm((f) => ({ ...f, idcc: e.target.value }))}
              placeholder="IDCC"
              className={`${inputClass} w-1/2`}
            />
            <input
              value={form.ape}
              onChange={(e) => setForm((f) => ({ ...f, ape: e.target.value }))}
              placeholder="APE"
              className={`${inputClass} w-1/2`}
            />
          </div>

          {config.requiresCommercial && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Commercial à assigner
              </label>
              <select
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                className={inputClass}
              >
                <option value="">— Sélectionner un commercial —</option>
                {commercialOptions.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {`${sp.firstName ?? ''} ${sp.lastName ?? ''}`.trim() || sp.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || updateResult.fetching || resolveResult.fetching}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-blue/20 bg-blue-light py-2 text-[12px] font-semibold text-blue hover:bg-blue hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(submitting || updateResult.fetching || resolveResult.fetching) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Enregistrer et résoudre
          </button>
        </div>
      </div>
    </div>
  )
}
