import { X, Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Entreprise, EntrepriseStatus } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { USERS } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'

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
  proprietaire_id: number
  date_relance: string
}

interface Props {
  initial?: Partial<Entreprise>
  prefillSiret?: string
  currentUser: AppUser
  onSave: (data: Partial<Entreprise>) => void
  onClose: () => void
  mode: 'create' | 'edit'
}

const STATUS_OPTIONS: EntrepriseStatus[] = ['Oui', 'Non', 'À Réfléchir']

export default function CreateEditModal({ initial, prefillSiret, currentUser, onSave, onClose, mode }: Props) {
  const ownerList = Object.values(USERS)

  const defaultOwner =
    mode === 'create'
      ? currentUser.id
      : (initial?.proprietaire_id ?? currentUser.id)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      nom_commercial: initial?.nom_commercial ?? '',
      siret: initial?.siret ?? prefillSiret ?? '',
      telephone: initial?.telephone ?? '',
      email: initial?.email ?? '',
      adresse: initial?.adresse ?? '',
      secteur: initial?.secteur ?? '',
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
    },
  })

  const onSubmit = (values: FormValues) => {
    const owner = USERS[values.proprietaire_id]
    onSave({
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
      proprietaire_id: owner?.id ?? null,
      commercial: owner?.name ?? null,
      date_relance: values.date_relance ? new Date(values.date_relance).toISOString() : new Date().toISOString(),
      ...(mode === 'create' && {
        date_insertion: new Date().toISOString(),
        proprietaire_contact: USERS[currentUser.id]?.email ?? null,
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

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 p-6">
          <div className="space-y-5">
            {/* Section: Identité */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Identité</p>
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
                  label="SIRET"
                  placeholder="14 chiffres"
                  {...register('siret')}
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
                <InputField
                  id="secteur"
                  label="Secteur"
                  placeholder="Ex: Saint-Denis"
                  {...register('secteur')}
                />
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
                    disabled={currentUser.role === 'commercial'}
                    className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue disabled:opacity-60 disabled:cursor-not-allowed"
                    {...register('proprietaire_id')}
                  >
                    {ownerList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  {currentUser.role === 'commercial' && (
                    <p className="text-xs text-gray-500">Vous serez automatiquement défini comme propriétaire</p>
                  )}
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
      </div>
    </div>
  )
}
