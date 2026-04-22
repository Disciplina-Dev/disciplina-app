import { Check } from 'lucide-react'
import type { ABFormData, JourSemaine } from '@/types/ab'
import { JOURS_SEMAINE } from '@/types/ab'
import { POSTES_BY_DOMAINE, MISSIONS_BY_POSTE, ENGAGEMENTS } from '@/constants/ab'
import Button from '@/components/ui/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-xl border border-gray-100 bg-white py-2.5 px-4 text-[13px] text-gray-900 outline-none transition-all focus:border-blue focus:shadow-[0_0_0_3px_rgba(17,48,167,0.06)] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] placeholder:text-gray-300'
export const textareaCls = `${inputCls} resize-none`
export const selectCls = `${inputCls} cursor-pointer`

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-4">{title}</p>
      {children}
    </div>
  )
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export function RadioGroup({ name, options, value, onChange }: {
  name: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label key={opt} className={[
          'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-medium cursor-pointer transition-all select-none',
          value === opt
            ? 'border-blue bg-blue text-white shadow-[0_2px_8px_-2px_rgba(17,48,167,0.4)]'
            : 'border-gray-100 bg-white text-gray-600 hover:border-blue/30 hover:bg-blue-light',
        ].join(' ')}>
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

export function StepIndicator({ current }: { current: number }) {
  const steps = ['Identité', 'Poste', 'Apprenti', 'Engagement', 'Récap']
  return (
    <div className="flex items-start mb-10">
      {steps.map((label, i) => {
        const num = i + 1
        const done = current > num
        const active = current === num
        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all',
                done ? 'bg-blue text-white' : active ? 'bg-blue text-white ring-4 ring-blue/20' : 'bg-gray-100 text-gray-400',
              ].join(' ')}>
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <span className={[
                'text-[11px] font-medium whitespace-nowrap',
                active ? 'text-blue' : done ? 'text-gray-700' : 'text-gray-400',
              ].join(' ')}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={['flex-1 h-px mx-3 mb-5 transition-colors', done ? 'bg-blue' : 'bg-gray-200'].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function NavButtons({ onBack, onNext, nextLabel = 'Suivant' }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string
}) {
  return (
    <div className="flex items-center justify-between pt-6 mt-2 border-t border-gray-100">
      {onBack
        ? <Button variant="secondary" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={onBack}>Précédent</Button>
        : <div />
      }
      <Button rightIcon={<ChevronRight className="h-4 w-4" />} onClick={onNext}>{nextLabel}</Button>
    </div>
  )
}

// ─── Step 1 — Identité ────────────────────────────────────────────────────────

export function Step1({ data, onChange }: { data: ABFormData; onChange: (p: Partial<ABFormData>) => void }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Identité">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dénomination ou raison sociale" required>
            <input type="text" value={data.raison_sociale}
              onChange={(e) => onChange({ raison_sociale: e.target.value })}
              className={inputCls} placeholder="Ex: Acme SARL" />
          </Field>
          <Field label="Numéro SIRET" required>
            <input type="text" value={data.siret}
              onChange={(e) => onChange({ siret: e.target.value })}
              className={inputCls} placeholder="14 chiffres" maxLength={14} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Coordonnées du siège">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Adresse du siège social" required>
              <input type="text" value={data.adresse_siege}
                onChange={(e) => onChange({ adresse_siege: e.target.value })}
                className={inputCls} placeholder="Numéro, rue" />
            </Field>
          </div>
          <Field label="Code postal" required>
            <input type="text" value={data.code_postal}
              onChange={(e) => {
                const cp = e.target.value
                onChange({ code_postal: cp })
                if (cp.length === 5) {
                  fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}`)
                    .then((res) => res.json())
                    .then((json) => {
                      if (json.length > 0) onChange({ code_postal: cp, commune: json[0].nom })
                    })
                    .catch(() => {})
                }
              }}
              className={inputCls} placeholder="97400" maxLength={5} />
          </Field>
          <Field label="Commune" required>
            <input type="text" value={data.commune}
              onChange={(e) => onChange({ commune: e.target.value })}
              className={inputCls} placeholder="Saint-Denis" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Représentant légal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nom et prénom" required>
            <input type="text" value={data.rl_nom}
              onChange={(e) => onChange({ rl_nom: e.target.value })}
              className={inputCls} placeholder="Prénom Nom" />
          </Field>
          <Field label="Fonction" required>
            <input type="text" value={data.rl_fonction}
              onChange={(e) => onChange({ rl_fonction: e.target.value })}
              className={inputCls} placeholder="Gérant, PDG…" />
          </Field>
          <Field label="Téléphone" required>
            <input type="tel" value={data.rl_telephone}
              onChange={(e) => onChange({ rl_telephone: e.target.value })}
              className={inputCls} placeholder="0692 XX XX XX" />
          </Field>
          <Field label="Courriel" required>
            <input type="email" value={data.rl_email}
              onChange={(e) => onChange({ rl_email: e.target.value })}
              className={inputCls} placeholder="contact@entreprise.re" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Responsable de recrutement">
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={data.rr_same_as_rl}
            onChange={(e) => onChange({
              rr_same_as_rl: e.target.checked,
              ...(e.target.checked && {
                rr_nom: data.rl_nom, rr_fonction: data.rl_fonction,
                rr_telephone: data.rl_telephone, rr_email: data.rl_email,
              }),
            })}
            className="h-4 w-4 rounded border-gray-300 accent-blue" />
          <span className="text-[13px] text-gray-700 font-medium">Même personne que le représentant légal</span>
        </label>
        {!data.rr_same_as_rl && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom et prénom">
              <input type="text" value={data.rr_nom}
                onChange={(e) => onChange({ rr_nom: e.target.value })}
                className={inputCls} placeholder="Prénom Nom" />
            </Field>
            <Field label="Fonction">
              <input type="text" value={data.rr_fonction}
                onChange={(e) => onChange({ rr_fonction: e.target.value })}
                className={inputCls} placeholder="Responsable RH…" />
            </Field>
            <Field label="Téléphone">
              <input type="tel" value={data.rr_telephone}
                onChange={(e) => onChange({ rr_telephone: e.target.value })}
                className={inputCls} placeholder="0692 XX XX XX" />
            </Field>
            <Field label="Courriel">
              <input type="email" value={data.rr_email}
                onChange={(e) => onChange({ rr_email: e.target.value })}
                className={inputCls} placeholder="rh@entreprise.re" />
            </Field>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Step 2 — Poste + missions ────────────────────────────────────────────────

export function Step2({ data, onChange }: { data: ABFormData; onChange: (p: Partial<ABFormData>) => void }) {
  const postes = data.domaine ? POSTES_BY_DOMAINE[data.domaine] : []
  const missions = data.intitule_poste ? (MISSIONS_BY_POSTE[data.intitule_poste] ?? []) : []

  return (
    <div className="space-y-5">
      <SectionCard title="À propos de l'entreprise">
        <div className="space-y-4">
          <Field label="Présentation de l'activité" required>
            <textarea rows={3} value={data.presentation_activite}
              onChange={(e) => onChange({ presentation_activite: e.target.value })}
              className={textareaCls}
              placeholder="Brève description de l'activité principale, secteurs concernés, mission globale" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre de postes à pourvoir" required>
              <input type="number" min={1} value={data.nb_postes}
                onChange={(e) => onChange({ nb_postes: e.target.value ? Number(e.target.value) : '' })}
                className={inputCls} placeholder="1" />
            </Field>
            <Field label="Localisation du poste" required>
              <input type="text" value={data.localisation_poste}
                onChange={(e) => onChange({ localisation_poste: e.target.value })}
                className={inputCls} placeholder="Commune" />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Exigences du poste">
        <div className="space-y-4">
          <Field label="Domaine de formation" required>
            <RadioGroup name="domaine" options={['Secretariat', 'Vente']} value={data.domaine}
              onChange={(v) => onChange({ domaine: v as ABFormData['domaine'], intitule_poste: '', missions: [] })} />
          </Field>
          {data.domaine && (
            <Field label="Intitulé du métier" required>
              <select value={data.intitule_poste}
                onChange={(e) => onChange({ intitule_poste: e.target.value, missions: [] })}
                className={selectCls}>
                <option value="">— Sélectionner un poste —</option>
                {postes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          )}
        </div>
      </SectionCard>

      {data.intitule_poste && (
        <SectionCard title="Description des missions">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-gray-400">{data.missions.length}/{missions.length} sélectionnées</span>
                <button type="button"
                  onClick={() => onChange({ missions: data.missions.length === missions.length ? [] : [...missions] })}
                  className="text-[12px] font-medium text-blue hover:underline">
                  {data.missions.length === missions.length ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>
              {missions.map((m) => (
                <label key={m} className="flex items-start gap-2.5 py-1 cursor-pointer group">
                  <input type="checkbox" checked={data.missions.includes(m)}
                    onChange={() => {
                      const next = data.missions.includes(m)
                        ? data.missions.filter((x) => x !== m)
                        : [...data.missions, m]
                      onChange({ missions: next })
                    }}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-blue" />
                  <span className="text-[13px] text-gray-700 group-hover:text-gray-900 leading-snug">{m}</span>
                </label>
              ))}
            </div>
            <Field label="Autres missions">
              <textarea rows={2} value={data.autres_missions}
                onChange={(e) => onChange({ autres_missions: e.target.value })}
                className={textareaCls} placeholder="Missions spécifiques non listées ci-dessus…" />
            </Field>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Profil et compétences">
        <div className="space-y-4">
          <Field label="Profils recherchés" required>
            <textarea rows={3} value={data.profils_recherches}
              onChange={(e) => onChange({ profils_recherches: e.target.value })}
              className={textareaCls}
              placeholder="Préciser les formations et expériences professionnelles souhaitées" />
          </Field>
          <Field label="Compétences et savoir-être" required>
            <textarea rows={3} value={data.competences}
              onChange={(e) => onChange({ competences: e.target.value })}
              className={textareaCls}
              placeholder="Compétences techniques, qualités personnelles, soft skills…" />
          </Field>
          <Field label="Commentaires supplémentaires">
            <textarea rows={2} value={data.commentaires}
              onChange={(e) => onChange({ commentaires: e.target.value })}
              className={textareaCls} placeholder="Horaires, salaires, avantages éventuels…" />
          </Field>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Step 3 — Exigences apprenti ─────────────────────────────────────────────

export const METHODES_RECRUTEMENT = [
  {
    value: 'Réception de tous les CV',
    description: "Vous recevez directement l'ensemble des candidatures et effectuez vous-même la sélection.",
  },
  {
    value: 'Présélection des CV par le CFA',
    description: "Le CFA filtre les candidatures selon vos critères et vous transmet uniquement les profils correspondants.",
  },
  {
    value: 'Pré-entretien des CV par le CFA',
    description: "Le CFA réalise un premier entretien avant de vous présenter les candidats les plus adaptés.",
  },
]

export function Step3({ data, onChange }: { data: ABFormData; onChange: (p: Partial<ABFormData>) => void }) {
  const updateJour = (jour: JourSemaine, val: string) =>
    onChange({ jours_formation: { ...data.jours_formation, [jour]: val } })

  return (
    <div className="space-y-5">
      <SectionCard title="Exigences de l'apprenti">
        <div className="space-y-5">
          <Field label="Niveau de formation" required>
            <RadioGroup name="niveau_formation"
              options={['Niveau Bac', 'Niveau Bac+2', 'Niveau Bac+3']}
              value={data.niveau_formation}
              onChange={(v) => onChange({ niveau_formation: v })} />
          </Field>
          <Field label="Permis de conduire" required>
            <RadioGroup name="permis" options={['Oui (requis)', 'Optionnel']}
              value={data.permis} onChange={(v) => onChange({ permis: v })} />
          </Field>
          <Field label="Expérience requise" required>
            <RadioGroup name="experience" options={['Débutant', 'Obligatoire']}
              value={data.experience} onChange={(v) => onChange({ experience: v })} />
          </Field>
          <Field label="Âge exigé" required>
            <RadioGroup name="age_exige"
              options={['18 à 20 ans', '21 à 25 ans', '26 à 29 ans', 'Pas de préférence']}
              value={data.age_exige} onChange={(v) => onChange({ age_exige: v })} />
          </Field>
          <Field label="Période d'immersion PMSMP" required>
            <RadioGroup name="pmsmp" options={['Oui', 'Non', 'À discuter ensemble']}
              value={data.pmsmp} onChange={(v) => onChange({ pmsmp: v })} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-gray-700">
              Méthode de recrutement <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="space-y-2.5 mt-1">
              {METHODES_RECRUTEMENT.map((m) => (
                <label key={m.value}
                  className={[
                    'flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all',
                    data.methode_recrutement === m.value
                      ? 'border-blue bg-blue-light shadow-[0_0_0_2px_rgba(17,48,167,0.15)]'
                      : 'border-gray-100 bg-white hover:border-blue/30',
                  ].join(' ')}>
                  <input type="radio" name="methode_recrutement" value={m.value}
                    checked={data.methode_recrutement === m.value}
                    onChange={() => onChange({ methode_recrutement: m.value })}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 border-gray-300 accent-blue" />
                  <div>
                    <p className={[
                      'text-[13px] font-semibold',
                      data.methode_recrutement === m.value ? 'text-blue' : 'text-gray-900',
                    ].join(' ')}>{m.value}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Jours de formation possibles">
        <p className="text-[12px] text-gray-400 mb-4">
          Indiquez pour chaque jour si votre apprenti peut être en formation. "Préféré" signale votre jour idéal.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 pr-6 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Jour</th>
                {(['Oui', 'Non', 'Préféré'] as const).map((opt) => (
                  <th key={opt} className="py-2 px-4 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{opt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOURS_SEMAINE.map((jour) => (
                <tr key={jour} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-6 text-[13px] font-medium text-gray-700 capitalize">{jour}</td>
                  {(['Oui', 'Non', 'Préféré'] as const).map((opt) => (
                    <td key={opt} className="py-3 px-4 text-center">
                      <input type="radio" name={`jour_${jour}`}
                        checked={data.jours_formation[jour] === opt}
                        onChange={() => updateJour(jour, opt)}
                        className="h-4 w-4 border-gray-300 accent-blue cursor-pointer" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Step 4 — Engagement ──────────────────────────────────────────────────────

export function Step4() {
  return (
    <div className="space-y-5">
      <SectionCard title="Engagement sur l'évolution des missions">
        <p className="text-[12px] text-gray-500 mb-3">
          Les missions confiées à l'apprenti s'engagent à :
        </p>
        <div className="space-y-2.5">
          {ENGAGEMENTS.map((eng) => (
            <div key={eng} className="flex items-start gap-2.5">
              <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-blue bg-blue flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
              <span className="text-[13px] text-gray-700 leading-snug">{eng}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Step 5 — Récapitulatif ───────────────────────────────────────────────────

function DocSep() {
  return <div className="border-t border-gray-100 my-6" />
}

function DocSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue text-white text-[11px] font-bold">
          {num}
        </span>
        <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="pl-8 space-y-4">{children}</div>
    </div>
  )
}

function DocSubTitle({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">{title}</p>
}

function DocGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-3">{children}</div>
}

function DocField({ label, value, full }: { label: string; value?: string | number | null; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-[13px] text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  )
}

export function Step5Recap({ data }: { data: ABFormData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_2px_16px_-4px_rgba(0,0,0,0.10)] overflow-hidden">
      <div className="bg-blue px-8 py-6">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[0.15em] mb-1">
          Analyse de Besoin — Disciplina
        </p>
        <h2 className="text-white text-[22px] font-extrabold leading-tight">
          {data.raison_sociale || '—'}
        </h2>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {data.domaine && (
            <span className="bg-white/20 text-white text-[11px] font-medium px-2.5 py-1 rounded-full">{data.domaine}</span>
          )}
          {data.intitule_poste && (
            <span className="bg-white/20 text-white text-[11px] font-medium px-2.5 py-1 rounded-full">{data.intitule_poste}</span>
          )}
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">
        <DocSection num="1" title="Identité de l'entreprise">
          <DocGrid>
            <DocField label="Raison sociale" value={data.raison_sociale} />
            <DocField label="SIRET" value={data.siret} />
            <DocField label="Adresse" value={data.adresse_siege} />
            <DocField label="Code postal" value={data.code_postal} />
            <DocField label="Commune" value={data.commune} />
          </DocGrid>
          <DocSubTitle title="Représentant légal" />
          <DocGrid>
            <DocField label="Nom et prénom" value={data.rl_nom} />
            <DocField label="Fonction" value={data.rl_fonction} />
            <DocField label="Téléphone" value={data.rl_telephone} />
            <DocField label="Courriel" value={data.rl_email} />
          </DocGrid>
          <DocSubTitle title="Responsable de recrutement" />
          {data.rr_same_as_rl ? (
            <p className="text-[12px] text-gray-400 italic">Même personne que le représentant légal</p>
          ) : (
            <DocGrid>
              <DocField label="Nom et prénom" value={data.rr_nom} />
              <DocField label="Fonction" value={data.rr_fonction} />
              <DocField label="Téléphone" value={data.rr_telephone} />
              <DocField label="Courriel" value={data.rr_email} />
            </DocGrid>
          )}
        </DocSection>

        <DocSep />

        <DocSection num="2" title="À propos de l'entreprise et exigences du poste">
          <DocGrid>
            <DocField label="Nombre de postes" value={data.nb_postes} />
            <DocField label="Localisation" value={data.localisation_poste} />
            <DocField label="Présentation de l'activité" value={data.presentation_activite} full />
          </DocGrid>
          <DocSubTitle title="Poste" />
          <DocGrid>
            <DocField label="Domaine" value={data.domaine} />
            <DocField label="Intitulé" value={data.intitule_poste} />
          </DocGrid>
          {data.missions.length > 0 && (
            <>
              <DocSubTitle title="Missions sélectionnées" />
              <ul className="space-y-1.5">
                {data.missions.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <div className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-blue bg-blue flex items-center justify-center">
                      <Check className="h-2 w-2 text-white" />
                    </div>
                    <span className="text-[12px] text-gray-700 leading-snug">{m}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {data.autres_missions && (
            <>
              <DocSubTitle title="Autres missions" />
              <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{data.autres_missions}</p>
            </>
          )}
          <DocSubTitle title="Profil et compétences" />
          <DocGrid>
            <DocField label="Profils recherchés" value={data.profils_recherches} full />
            <DocField label="Compétences et savoir-être" value={data.competences} full />
            {data.commentaires && <DocField label="Commentaires" value={data.commentaires} full />}
          </DocGrid>
        </DocSection>

        <DocSep />

        <DocSection num="3" title="Exigences de l'apprenti">
          <DocGrid>
            <DocField label="Niveau de formation" value={data.niveau_formation} />
            <DocField label="Permis de conduire" value={data.permis} />
            <DocField label="Expérience requise" value={data.experience} />
            <DocField label="Âge exigé" value={data.age_exige} />
            <DocField label="Période d'immersion PMSMP" value={data.pmsmp} />
            <DocField label="Méthode de recrutement" value={data.methode_recrutement} full />
          </DocGrid>
          <DocSubTitle title="Jours de formation possibles" />
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-4 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Jour</th>
                  {(['Oui', 'Non', 'Préféré'] as const).map((opt) => (
                    <th key={opt} className="py-2 px-4 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{opt}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JOURS_SEMAINE.map((jour, i) => (
                  <tr key={jour} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="py-2.5 px-4 text-[12px] font-medium text-gray-700 capitalize">{jour}</td>
                    {(['Oui', 'Non', 'Préféré'] as const).map((opt) => (
                      <td key={opt} className="py-2.5 px-4 text-center">
                        {data.jours_formation[jour] === opt ? (
                          <span className={[
                            'inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold',
                            opt === 'Préféré' ? 'bg-blue' : opt === 'Oui' ? 'bg-green-500' : 'bg-gray-300',
                          ].join(' ')}>✓</span>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSep />

        <DocSection num="4" title="Engagement sur l'évolution des missions">
          <div className="space-y-2">
            {ENGAGEMENTS.map((eng) => (
              <div key={eng} className="flex items-start gap-2.5">
                <div className="mt-0.5 h-4 w-4 shrink-0 rounded border border-blue bg-blue flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="text-[12px] text-gray-700 leading-snug">{eng}</span>
              </div>
            ))}
          </div>
        </DocSection>
      </div>
    </div>
  )
}
