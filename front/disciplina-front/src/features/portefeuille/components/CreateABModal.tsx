import { X, FileText, ChevronLeft, ChevronRight, Check, Shield } from 'lucide-react'
import { useState } from 'react'
import type { Entreprise } from '@/types/entreprise'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'

// ─── Constants ────────────────────────────────────────────────────────────────

const NIVEAUX_BY_DOMAINE: Record<'Vente' | 'Secrétariat', string[]> = {
  Secrétariat: ['Bac', 'Bac+2'],
  Vente: ['Bac', 'Bac+2', 'Bac+3'],
}

const MISSIONS_BY_KEY: Record<string, string[]> = {
  'Secrétariat-Bac': [
    'Accueil physique et téléphonique',
    'Gestion du courrier entrant/sortant',
    'Rédaction de courriers et documents simples',
    'Classement et archivage',
    'Gestion des fournitures de bureau',
    'Saisie et mise en forme de documents',
  ],
  'Secrétariat-Bac+2': [
    'Accueil physique et téléphonique',
    'Gestion du courrier entrant/sortant',
    'Rédaction de documents administratifs et contractuels',
    'Gestion des agendas et plannings',
    'Organisation de réunions et déplacements professionnels',
    'Suivi comptable et facturation',
    'Gestion des dossiers clients et fournisseurs',
    'Classement et archivage numérique',
    'Suivi des tableaux de bord de gestion',
  ],
  'Vente-Bac': [
    'Accueil et conseil client en magasin',
    'Mise en rayon et merchandising',
    'Gestion de caisse et encaissement',
    'Gestion des stocks et réapprovisionnement',
    'Participation aux animations commerciales',
    'Maintien de la propreté du point de vente',
  ],
  'Vente-Bac+2': [
    'Accueil et conseil client',
    'Prospection commerciale (téléphonique et terrain)',
    'Négociation et closing',
    'Gestion et fidélisation du portefeuille clients',
    'Réalisation de devis et bons de commande',
    'Suivi administratif des ventes',
    'Participation aux actions marketing et promotionnelles',
    'Reporting et suivi des indicateurs commerciaux',
  ],
  'Vente-Bac+3': [
    'Pilotage de l\'activité commerciale',
    'Management et animation d\'équipe',
    'Développement et fidélisation d\'un portefeuille grands comptes',
    'Élaboration et suivi du budget commercial',
    'Définition et mise en œuvre de la stratégie commerciale',
    'Analyse des performances et tableaux de bord',
    'Développement de partenariats stratégiques',
    'Représentation de l\'entreprise lors d\'événements professionnels',
  ],
}

const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

const CLAUSES = [
  "Je m'engage à accompagner l'évolution pédagogique de l'apprenti tout au long de son parcours.",
  "Je m'engage à adapter les missions confiées à l'apprenti en fonction de sa progression.",
  "J'accepte de participer à toute démarche de réajustement si des difficultés venaient à apparaître.",
  "J'ai pris connaissance de la clause de confidentialité et j'accepte les conditions de traitement de mes données personnelles conformément au RGPD.",
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Domaine = 'Vente' | 'Secrétariat'

interface ABFormData {
  // Étape 1 — Entreprise
  siret: string
  raison_sociale: string
  adresse: string
  code_postal: string
  commune: string
  description_activite: string
  // Étape 2 — Contacts
  rl_nom_prenom: string
  rl_fonction: string
  rl_telephone: string
  rl_mail: string
  rr_same_as_rl: boolean
  rr_nom_prenom: string
  rr_fonction: string
  rr_telephone: string
  rr_mail: string
  // Étape 3 — Le poste
  domaine: Domaine | ''
  niveau: string
  intitule_metier: string
  localisation_poste: string
  missions: string[]
  // Étape 4 — Détails & Apprenti
  description_missions: string
  profil_recherche: string
  competences_savoir_etre: string
  commentaires: string
  age: string
  permis_candidat: string
  experience: string
  // Étape 5 — Recrutement
  pmsmp: 'Oui' | 'Non' | 'À discuter' | ''
  jours_formation: Record<string, boolean>
  // Étape 6 — Engagements
  engagements: boolean[]
}

interface Props {
  entreprise: Entreprise
  onClose: () => void
  onSubmit: (data: ABFormData) => void
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function Textarea({
  id,
  label,
  placeholder,
  value,
  onChange,
  rows = 3,
}: {
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue resize-none"
      />
    </div>
  )
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
              value === o
                ? 'border-blue bg-blue text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left w-full group"
    >
      <span
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all',
          checked
            ? 'border-blue bg-blue'
            : 'border-gray-300 bg-white group-hover:border-gray-400',
        ].join(' ')}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </span>
      <span className="text-sm text-gray-700 leading-relaxed">{label}</span>
    </button>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Entreprise',
  'Contacts',
  'Le poste',
  'Détails & Profil',
  'Recrutement',
  'Engagements',
]

const TOTAL_STEPS = STEP_LABELS.length

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={[
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all',
              i < current
                ? 'bg-blue text-white'
                : i === current
                  ? 'bg-blue text-white ring-[3px] ring-blue/20'
                  : 'bg-gray-100 text-gray-400',
            ].join(' ')}
          >
            {i < current ? <Check className="h-2.5 w-2.5" /> : i + 1}
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div
              className={[
                'h-0.5 w-4 rounded-full transition-all',
                i < current ? 'bg-blue' : 'bg-gray-100',
              ].join(' ')}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function initJours(): Record<string, boolean> {
  return Object.fromEntries(JOURS_SEMAINE.map((j) => [j, false]))
}

export default function CreateABModal({ entreprise, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ABFormData>({
    siret: entreprise.siret ?? '',
    raison_sociale: entreprise.nom_commercial ?? '',
    adresse: entreprise.adresse ?? '',
    code_postal: '',
    commune: '',
    description_activite: '',
    rl_nom_prenom: entreprise.representant_legal ?? '',
    rl_fonction: '',
    rl_telephone: entreprise.telephone ?? '',
    rl_mail: entreprise.email ?? '',
    rr_same_as_rl: false,
    rr_nom_prenom: '',
    rr_fonction: '',
    rr_telephone: '',
    rr_mail: '',
    domaine: '',
    niveau: '',
    intitule_metier: '',
    localisation_poste: '',
    missions: [],
    description_missions: '',
    profil_recherche: '',
    competences_savoir_etre: '',
    commentaires: '',
    age: '',
    permis_candidat: '',
    experience: '',
    pmsmp: '',
    jours_formation: initJours(),
    engagements: [false, false, false, false],
  })

  const set = <K extends keyof ABFormData>(key: K, value: ABFormData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  // Missions disponibles selon domaine + niveau
  const missionsKey = data.domaine && data.niveau ? `${data.domaine}-${data.niveau}` : ''
  const availableMissions = missionsKey ? (MISSIONS_BY_KEY[missionsKey] ?? []) : []

  const toggleMission = (m: string) => {
    set('missions', data.missions.includes(m) ? data.missions.filter((x) => x !== m) : [...data.missions, m])
  }

  const canAdvance = (): boolean => {
    if (step === 0) return !!data.raison_sociale.trim()
    if (step === 1) return !!data.rl_nom_prenom.trim() && (data.rr_same_as_rl || !!data.rr_nom_prenom.trim())
    if (step === 2) return !!data.domaine && !!data.niveau && !!data.intitule_metier.trim()
    if (step === TOTAL_STEPS - 1) return data.engagements.every(Boolean)
    return true
  }

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = () => {
    const finalData = data.rr_same_as_rl
      ? {
          ...data,
          rr_nom_prenom: data.rl_nom_prenom,
          rr_fonction: data.rl_fonction,
          rr_telephone: data.rl_telephone,
          rr_mail: data.rl_mail,
        }
      : data
    onSubmit(finalData)
  }

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
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light">
              <FileText className="h-5 w-5 text-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                Nouvelle analyse de besoin
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Étape {step + 1}/{TOTAL_STEPS} — {STEP_LABELS[step]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StepIndicator current={step} />
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── Étape 1 : Identification de l'entreprise ── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Identification de l'entreprise</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    id="siret"
                    label="SIRET"
                    placeholder="14 chiffres"
                    value={data.siret}
                    onChange={(e) => set('siret', e.target.value)}
                  />
                  <InputField
                    id="raison_sociale"
                    label="Raison sociale *"
                    value={data.raison_sociale}
                    onChange={(e) => set('raison_sociale', e.target.value)}
                  />
                  <div className="sm:col-span-2">
                    <InputField
                      id="adresse"
                      label="Adresse"
                      placeholder="Numéro et nom de rue"
                      value={data.adresse}
                      onChange={(e) => set('adresse', e.target.value)}
                    />
                  </div>
                  <InputField
                    id="code_postal"
                    label="Code postal"
                    placeholder="97400"
                    value={data.code_postal}
                    onChange={(e) => set('code_postal', e.target.value)}
                  />
                  <InputField
                    id="commune"
                    label="Commune"
                    placeholder="Saint-Denis"
                    value={data.commune}
                    onChange={(e) => set('commune', e.target.value)}
                  />
                  <div className="sm:col-span-2">
                    <Textarea
                      id="description_activite"
                      label="Description de l'activité de l'entreprise"
                      placeholder="Décrivez brièvement l'activité principale…"
                      value={data.description_activite}
                      onChange={(v) => set('description_activite', v)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 2 : Contacts ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Représentant légal *</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    id="rl_nom_prenom"
                    label="Nom & Prénom *"
                    value={data.rl_nom_prenom}
                    onChange={(e) => set('rl_nom_prenom', e.target.value)}
                  />
                  <InputField
                    id="rl_fonction"
                    label="Fonction"
                    placeholder="Ex: Directeur Général"
                    value={data.rl_fonction}
                    onChange={(e) => set('rl_fonction', e.target.value)}
                  />
                  <InputField
                    id="rl_telephone"
                    label="Téléphone"
                    placeholder="0692 XX XX XX"
                    value={data.rl_telephone}
                    onChange={(e) => set('rl_telephone', e.target.value)}
                  />
                  <InputField
                    id="rl_mail"
                    label="E-mail"
                    type="email"
                    value={data.rl_mail}
                    onChange={(e) => set('rl_mail', e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>Responsable de recrutement</SectionTitle>
                  <Checkbox
                    checked={data.rr_same_as_rl}
                    onChange={(v) => set('rr_same_as_rl', v)}
                    label="Même que le représentant légal"
                  />
                </div>
                {!data.rr_same_as_rl && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      id="rr_nom_prenom"
                      label="Nom & Prénom *"
                      value={data.rr_nom_prenom}
                      onChange={(e) => set('rr_nom_prenom', e.target.value)}
                    />
                    <InputField
                      id="rr_fonction"
                      label="Fonction"
                      placeholder="Ex: Responsable RH"
                      value={data.rr_fonction}
                      onChange={(e) => set('rr_fonction', e.target.value)}
                    />
                    <InputField
                      id="rr_telephone"
                      label="Téléphone"
                      placeholder="0692 XX XX XX"
                      value={data.rr_telephone}
                      onChange={(e) => set('rr_telephone', e.target.value)}
                    />
                    <InputField
                      id="rr_mail"
                      label="E-mail"
                      type="email"
                      value={data.rr_mail}
                      onChange={(e) => set('rr_mail', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 3 : Le poste ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <SectionTitle>Formation visée</SectionTitle>
                <div className="space-y-4">
                  <RadioGroup
                    label="Domaine *"
                    options={['Vente', 'Secrétariat']}
                    value={data.domaine}
                    required
                    onChange={(v) => {
                      set('domaine', v as Domaine)
                      set('niveau', '')
                      set('missions', [])
                    }}
                  />
                  {data.domaine && (
                    <RadioGroup
                      label="Niveau *"
                      options={NIVEAUX_BY_DOMAINE[data.domaine as Domaine]}
                      value={data.niveau}
                      required
                      onChange={(v) => {
                        set('niveau', v)
                        set('missions', [])
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Information sur le poste</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    id="intitule_metier"
                    label="Intitulé du métier *"
                    placeholder="Ex: Conseiller Commercial"
                    value={data.intitule_metier}
                    onChange={(e) => set('intitule_metier', e.target.value)}
                  />
                  <InputField
                    id="localisation_poste"
                    label="Localisation du poste"
                    placeholder="Ville, quartier…"
                    value={data.localisation_poste}
                    onChange={(e) => set('localisation_poste', e.target.value)}
                  />
                </div>
              </div>

              {availableMissions.length > 0 && (
                <div className="border-t border-gray-100 pt-5">
                  <SectionTitle>Tableau des missions</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableMissions.map((m) => {
                      const checked = data.missions.includes(m)
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMission(m)}
                          className={[
                            'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-all',
                            checked
                              ? 'border-blue/30 bg-blue-light text-blue'
                              : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                              checked ? 'border-blue bg-blue' : 'border-gray-300 bg-white',
                            ].join(' ')}
                          >
                            {checked && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 4 : Détails & Profil apprenti ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <SectionTitle>Détails complémentaires</SectionTitle>
                <div className="space-y-4">
                  <Textarea
                    id="description_missions"
                    label="Description des missions"
                    placeholder="Détaillez les missions qui seront confiées à l'apprenti…"
                    value={data.description_missions}
                    onChange={(v) => set('description_missions', v)}
                  />
                  <Textarea
                    id="profil_recherche"
                    label="Profil recherché"
                    placeholder="Décrivez le profil idéal…"
                    value={data.profil_recherche}
                    onChange={(v) => set('profil_recherche', v)}
                  />
                  <Textarea
                    id="competences_savoir_etre"
                    label="Compétences et savoir-être attendus"
                    placeholder="Ex: rigueur, sens du contact, maîtrise des outils bureautiques…"
                    value={data.competences_savoir_etre}
                    onChange={(v) => set('competences_savoir_etre', v)}
                  />
                  <Textarea
                    id="commentaires"
                    label="Commentaires / Informations complémentaires"
                    placeholder="Toute information utile…"
                    value={data.commentaires}
                    onChange={(v) => set('commentaires', v)}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Profil de l'apprenti recherché</SectionTitle>
                <div className="space-y-4">
                  <RadioGroup
                    label="Tranche d'âge"
                    options={['18 – 20 ans', '21 – 25 ans', '25 – 29 ans', 'Sans préférence']}
                    value={data.age}
                    onChange={(v) => set('age', v)}
                  />
                  <RadioGroup
                    label="Permis de conduire"
                    options={['Obligatoire', 'Optionnel', 'Non requis']}
                    value={data.permis_candidat}
                    onChange={(v) => set('permis_candidat', v)}
                  />
                  <RadioGroup
                    label="Expérience professionnelle"
                    options={['Débutant accepté', 'Expérience obligatoire']}
                    value={data.experience}
                    onChange={(v) => set('experience', v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 5 : Recrutement ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <SectionTitle>PMSMP — Période de mise en situation en milieu professionnel</SectionTitle>
                <RadioGroup
                  label="L'entreprise est-elle favorable à une PMSMP ?"
                  options={['Oui', 'Non', 'À discuter']}
                  value={data.pmsmp}
                  onChange={(v) => set('pmsmp', v as ABFormData['pmsmp'])}
                />
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Jours de formation préférés</SectionTitle>
                <p className="text-xs text-gray-400 mb-3">
                  Indiquez les jours où l'apprenti peut être en centre de formation.
                </p>
                <div className="flex flex-wrap gap-2">
                  {JOURS_SEMAINE.map((jour) => {
                    const preferred = data.jours_formation[jour]
                    return (
                      <button
                        key={jour}
                        type="button"
                        onClick={() =>
                          set('jours_formation', { ...data.jours_formation, [jour]: !preferred })
                        }
                        className={[
                          'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                          preferred
                            ? 'border-blue bg-blue text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {jour}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 6 : Clause de confidentialité ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-light">
                  <Shield className="h-4 w-4 text-blue" />
                </div>
                <SectionTitle>Engagements et clause de confidentialité</SectionTitle>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 space-y-3 leading-relaxed">
                <p className="font-semibold text-gray-800">
                  Dans le cadre de notre partenariat, l'entreprise s'engage à respecter les conditions suivantes :
                </p>
                <div>
                  <p className="font-medium text-gray-700">1. Engagement pédagogique</p>
                  <p>L'entreprise s'engage à accompagner l'apprenti dans l'acquisition des compétences professionnelles définies dans le référentiel de formation, à lui confier des missions en adéquation avec sa formation et à désigner un maître d'apprentissage référent.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">2. Engagement d'adaptation</p>
                  <p>L'entreprise s'engage à adapter les missions de l'apprenti à son niveau de progression tout au long du contrat, à participer aux évaluations et bilans organisés par Disciplina, et à signaler toute difficulté rencontrée.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">3. Réajustement du parcours</p>
                  <p>En cas de difficulté avérée, l'entreprise accepte de participer aux démarches de réajustement proposées par Disciplina, dans l'intérêt de l'apprenti et de la bonne exécution du contrat d'apprentissage.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">4. Confidentialité</p>
                  <p>Les informations partagées dans le cadre de cette Analyse de Besoin sont strictement confidentielles et ne seront utilisées que dans le cadre du recrutement d'un apprenti par Disciplina. Elles ne seront transmises à aucun tiers sans l'accord exprès de l'entreprise.</p>
                  <p className="mt-1">Les données personnelles collectées sont traitées conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679). L'entreprise dispose d'un droit d'accès, de rectification et de suppression de ses données en contactant Disciplina.</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {CLAUSES.map((clause, i) => (
                  <Checkbox
                    key={i}
                    checked={data.engagements[i]}
                    onChange={(v) => {
                      const next = [...data.engagements]
                      next[i] = v
                      set('engagements', next)
                    }}
                    label={clause}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          {step > 0 ? (
            <Button variant="ghost" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={prev}>
              Retour
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              rightIcon={<ChevronRight className="h-4 w-4" />}
              disabled={!canAdvance()}
              onClick={next}
            >
              Suivant
            </Button>
          ) : (
            <Button
              leftIcon={<Check className="h-4 w-4" />}
              disabled={!canAdvance()}
              onClick={handleSubmit}
              className="shadow-[0_2px_8px_-2px_rgba(17,48,167,0.30)]"
            >
              Valider l'analyse de besoin
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
