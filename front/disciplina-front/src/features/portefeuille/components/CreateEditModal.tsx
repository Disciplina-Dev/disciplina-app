import { useState } from 'react'
import { X, Building2, ArrowRight, AlertTriangle } from 'lucide-react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import type { Entreprise, EntrepriseStatus } from '@/types/entreprise'
import { STATUS_VALUES, SECTEUR_VALUES, DEFAULT_SECTEUR } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { fullName } from '@/store/authStore'
import { apiFetch } from '@/api/httpClient'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { useCommercialMailTemplatesStore } from '@/store/mailTemplatesStore'
import { RELANCE_TYPES, computeRelanceDate } from '@/types/relance'
import { useStaffDirectory } from '@/hooks/useStaffDirectory'

interface SireneResult {
  denomination: string | null
  nomPrenom: string | null
  adresse: {
    numeroVoie: string | null
    typeVoie: string | null
    libelleVoie: string | null
    codePostal: string | null
    commune: string | null
  }
  alreadyExists?: boolean
}

type FormValues = {
  nom_commercial: string
  siret: string
  telephone: string
  email: string
  adresse: string
  secteur: string
  metier: string
  representant_legal: string
  idcc: string
  note: string
  conclusion: string
  status: EntrepriseStatus
  proprietaire_id: string
  date_relance: string
  type_relance: string
  relance_template_id: string
  relance_channel: string
}

interface Props {
  initial?: Partial<Entreprise>
  prefillSiret?: string
  currentUser: AppUser
  onSave: (data: Partial<Entreprise>) => void | Promise<void>
  onClose: () => void
  mode: 'create' | 'edit'
  submitError?: string | null
}

const STATUS_OPTIONS: EntrepriseStatus[] = STATUS_VALUES

export default function CreateEditModal({ initial, prefillSiret, currentUser, onSave, onClose, mode, submitError }: Props) {
  const mailTemplates = useCommercialMailTemplatesStore((s) => s.templates)
  const { directory } = useStaffDirectory()
  const staffMembers = Object.values(directory).sort((a, b) =>
    fullName(a).localeCompare(fullName(b)),
  )

  const defaultOwner =
    mode === 'create'
      ? currentUser.id
      : String(initial?.proprietaire_id ?? currentUser.id)

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      nom_commercial: initial?.nom_commercial ?? '',
      siret: initial?.siret ?? prefillSiret ?? '',
      telephone: initial?.telephone ?? '',
      email: initial?.email ?? '',
      adresse: initial?.adresse ?? '',
      secteur: initial?.secteur ?? DEFAULT_SECTEUR,
      metier: initial?.metier ?? '',
      representant_legal: initial?.representant_legal ?? '',
      idcc: initial?.idcc ?? '',
      note: initial?.note ?? '',
      conclusion: initial?.conclusion ?? '',
      status: initial?.status ?? 'Non',
      proprietaire_id: defaultOwner,
      date_relance: initial?.date_relance
        ? initial.date_relance.slice(0, 10)
        : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      type_relance: initial?.type_relance ? String(initial.type_relance) : '',
      relance_template_id: initial?.relance_template_id ?? '',
      relance_channel: initial?.relance_channel ?? '',
    },
  })

  const relanceChannel = watch('relance_channel')

  // Two-step flow state
  const [step, setStep] = useState<'lookup' | 'form'>(mode === 'create' ? 'lookup' : 'form')
  const [siretInput, setSiretInput] = useState(prefillSiret ?? '')
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'notfound' | 'error' | 'exists'>('idle')
  const [fromRegistry, setFromRegistry] = useState(false)

  const handleLookup = async () => {
    const digits = siretInput.replace(/\D/g, '')
    if (digits.length !== 14) return
    setLookupStatus('loading')
    try {
      const res = await apiFetch(`/api/sourcing/${digits}`)
      if (res.status === 404) { setLookupStatus('notfound'); return }
      if (!res.ok) { setLookupStatus('error'); return }
      const data = (await res.json()) as SireneResult
      if (data.alreadyExists) {
        setLookupStatus('exists')
        return
      }
      const name = data.denomination ?? data.nomPrenom ?? ''
      const street = [data.adresse.numeroVoie, data.adresse.typeVoie, data.adresse.libelleVoie]
        .filter(Boolean).join(' ')
      const cityPart = [data.adresse.codePostal, data.adresse.commune].filter(Boolean).join(' ')
      const fullAddress = [street, cityPart].filter(Boolean).join(', ')
      if (name) setValue('nom_commercial', name, { shouldValidate: true })
      setValue('siret', digits)
      if (fullAddress) setValue('adresse', fullAddress)
      if (data.adresse.commune) setValue('note', `Commune: ${data.adresse.commune}`)
      setFromRegistry(true)
      setStep('form')
    } catch {
      setLookupStatus('error')
    }
  }

  const goToFormManually = () => {
    setValue('siret', siretInput)
    setStep('form')
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    await onSave({
      id: initial?.id,
      nom_commercial: values.nom_commercial || null,
      siret: values.siret || null,
      telephone: values.telephone || null,
      email: values.email || null,
      adresse: values.adresse || null,
      secteur: values.secteur || null,
      metier: values.metier || null,
      representant_legal: values.representant_legal || null,
      idcc: values.idcc || null,
      note: values.note || null,
      conclusion: values.conclusion || null,
      status: values.status,
      proprietaire_id: values.proprietaire_id ? Number(values.proprietaire_id) : null,
      commercial: fullName(directory[String(values.proprietaire_id)] ?? currentUser),
      date_relance: values.date_relance || null,
      type_relance: values.type_relance ? Number(values.type_relance) : null,
      relance_template_id: values.relance_channel === 'MAIL' ? values.relance_template_id || null : null,
      relance_channel: values.relance_channel || null,
      ...(mode === 'create' && {
        date_insertion: new Date().toISOString(),
        proprietaire_contact: currentUser.email ?? null,
      }),
    })
  }

  const title = mode === 'create' ? 'Nouvelle fiche entreprise' : 'Modifier la fiche'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-light">
              <Building2 className="h-5 w-5 text-blue" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'lookup' ? (
          <>
            {/* Lookup body */}
            <div className="p-6 flex-1 flex flex-col gap-4">
              <p className="text-sm text-gray-500">
                Entrez le numéro SIRET de l'entreprise pour pré-remplir la fiche depuis le registre INSEE.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="siret-lookup">
                  Numéro SIRET
                </label>
                <div className="flex gap-2">
                  <input
                    id="siret-lookup"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                    autoFocus
                    placeholder="14 chiffres"
                    value={siretInput}
                    onChange={(e) => { setSiretInput(e.target.value.replace(/\D/g, '')); setLookupStatus('idle') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    className="flex-1 rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue font-mono tracking-wider"
                  />
                  <Button
                    onClick={handleLookup}
                    isLoading={lookupStatus === 'loading'}
                    disabled={siretInput.replace(/\D/g, '').length !== 14}
                  >
                    Rechercher
                  </Button>
                </div>
                <p className="text-xs text-gray-400 font-mono">{siretInput.replace(/\D/g, '').length}/14</p>

                {lookupStatus === 'notfound' && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    SIRET introuvable dans le registre INSEE
                  </p>
                )}
                {lookupStatus === 'error' && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Erreur lors de la recherche — réessayez
                  </p>
                )}
                {lookupStatus === 'exists' && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Cette entreprise est déjà dans le portefeuille
                  </p>
                )}
              </div>
            </div>

            {/* Lookup footer */}
            <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={goToFormManually}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                Remplir manuellement <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <Button variant="secondary" onClick={onClose}>Annuler</Button>
            </div>
          </>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 p-6">
              <div className="space-y-5">
                {submitError && (
                  <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-2.5 text-sm text-danger">
                    {submitError}
                  </div>
                )}
                {/* Section: Identité */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    Identité
                    {fromRegistry && (
                      <span className="text-[10px] font-semibold normal-case tracking-normal text-success bg-success-bg px-2 py-0.5 rounded-full">
                        Données INSEE
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      id="nom_commercial"
                      label="Nom commercial *"
                      placeholder="Ex: Acme SARL"
                      error={errors.nom_commercial?.message}
                      {...register('nom_commercial', { required: 'Champ obligatoire' })}
                    />
                    <InputField
                      id="siret"
                      label="SIRET *"
                      placeholder="14 chiffres"
                      error={errors.siret?.message}
                      {...register('siret', {
                        required: 'Le SIRET est obligatoire',
                        pattern: {
                          value: /^\d{14}$/,
                          message: 'Le SIRET doit contenir exactement 14 chiffres'
                        },
                        validate: async (value) => {
                          if (mode !== 'create') return true
                          if (!/^\d{14}$/.test(value)) return true
                          try {
                            const res = await apiFetch(`/api/sourcing/${value}`)
                            if (!res.ok) return true
                            const data = await res.json()
                            if (data.alreadyExists) return 'Ce SIRET est déjà dans le portefeuille'
                          } catch {
                            // network failure — let submit proceed
                          }
                          return true
                        }
                      })}
                    />
                    <InputField
                      id="representant_legal"
                      label="Représentant légal"
                      placeholder="Prénom Nom"
                      {...register('representant_legal')}
                    />
                    <InputField
                      id="idcc"
                      label="IDCC"
                      placeholder="Code convention collective"
                      {...register('idcc')}
                    />
                  </div>
                </div>

                {/* Section: Localisation */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Localisation</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      id="adresse"
                      label="Adresse"
                      placeholder="Rue, CP, Ville"
                      {...register('adresse')}
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="secteur">
                        Secteur
                      </label>
                      <select
                        id="secteur"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('secteur')}
                      >
                        {SECTEUR_VALUES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Contact */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      id="telephone"
                      label="Téléphone"
                      placeholder="0262 XX XX XX"
                      {...register('telephone')}
                    />
                    <InputField
                      id="email"
                      label="Adresse e-mail"
                      type="email"
                      placeholder="contact@entreprise.re"
                      {...register('email')}
                    />
                    <InputField
                      id="metier"
                      label="Métier / Description"
                      placeholder="Ex: Conseil vente"
                      {...register('metier')}
                    />
                  </div>
                </div>

                {/* Section: Suivi */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Suivi commercial</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="status">
                        Statut
                      </label>
                      <select
                        id="status"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('status')}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Propriétaire */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="proprietaire_id">
                        Propriétaire du contact
                      </label>
                      <select
                        id="proprietaire_id"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('proprietaire_id')}
                      >
                        {staffMembers.length === 0 && (
                          <option value={String(currentUser.id ?? '')}>{fullName(currentUser)}</option>
                        )}
                        {staffMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {fullName(m)} ({m.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Canal de relance */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="relance_channel">
                        Canal de relance
                      </label>
                      <select
                        id="relance_channel"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('relance_channel')}
                      >
                        <option value="">— Aucun —</option>
                        <option value="PHONE">📞 Téléphone</option>
                        <option value="MAIL">✉️ Mail</option>
                      </select>
                    </div>

                    {/* Type de relance — recalcule la date */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="type_relance">
                        Type de relance
                      </label>
                      <select
                        id="type_relance"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('type_relance', {
                          onChange: (e) => {
                            const typeId = e.target.value ? Number(e.target.value) : null
                            // « Aucun » vide aussi la date : pas de type = pas de relance.
                            setValue('date_relance', typeId ? computeRelanceDate(typeId) : '')
                          },
                        })}
                      >
                        <option value="">— Aucun —</option>
                        {RELANCE_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label} · {t.description}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date relance */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="date_relance">
                        Date de relance
                      </label>
                      <input
                        id="date_relance"
                        type="date"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('date_relance')}
                      />
                    </div>

                    {/* Mail type de relance — seulement si canal = MAIL */}
                    <div className={`flex flex-col gap-1.5 ${relanceChannel === 'MAIL' ? '' : 'hidden'}`}>
                      <label className="text-sm font-medium text-gray-700" htmlFor="relance_template_id">
                        Mail type de relance
                      </label>
                      <select
                        id="relance_template_id"
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue"
                        {...register('relance_template_id')}
                      >
                        <option value="">— Aucun —</option>
                        {mailTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {mailTemplates.length === 0 && (
                        <p className="text-xs text-gray-500">Aucun modèle — créez-en dans « Modèles mail »</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Notes</p>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="note">
                        Note personnelle
                      </label>
                      <textarea
                        id="note"
                        rows={3}
                        placeholder="Observations, contexte..."
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue resize-none"
                        {...register('note')}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700" htmlFor="conclusion">
                        Conclusion
                      </label>
                      <textarea
                        id="conclusion"
                        rows={3}
                        placeholder="Résultat des échanges..."
                        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue resize-none"
                        {...register('conclusion')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
              <Button variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                onClick={handleSubmit(onSubmit)}
              >
                {mode === 'create' ? 'Créer la fiche' : 'Enregistrer'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
