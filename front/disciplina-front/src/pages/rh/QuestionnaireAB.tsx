import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, CheckCircle } from 'lucide-react'
import InputField from '@/components/ui/InputField'
import MultiSelectField from '@/components/ui/MultiSelectField'
import Button from '@/components/ui/Button'
import { cityFromPostalCode, LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { SkillLevel, TitleProfessionalType, TrainingSite, Localisation } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import { useCandidateFull } from '@/graphql/hooks'
import { CANDIDATE_TEMPLATES, TP_TYPE_LABELS, SKILL_LEVEL_LABELS, DISCOVERY_SOURCE_LABELS, TRAINING_SITE_LABELS } from '@/data/candidateTemplates'
import { SECTOR_LABELS } from '@/data/sectors'
import { candidateGraphqlClient } from '@/graphql/client'
import SignaturePad from '@/components/ui/SignaturePad'
import { useAuthStore } from '@/store/authStore'
import { UPDATE_CANDIDATE_FULL } from '@/graphql/queries'

// ─── Form state ───────────────────────────────────────────────────────────────

interface Experience { position: string; duration: string; responsibilities: string; company: string }
interface PedaReco {
  officeToolsReinforcement: boolean; writtenCommunicationSupport: boolean
  oralConfidenceDevelopment: boolean; timeManagementSupport: boolean
  professionalPostureWork: boolean; enhancedCompanyImmersion: boolean
  pshSpecificSupport: boolean; individualFollowUp: boolean
  languageTraining: boolean; stressManagementFollowUp: boolean
}

interface FormState {
  tp_type: TitleProfessionalType
  tp_types: TitleProfessionalType[]
  // identité
  full_name: string; email: string; phone: string
  date_of_birth: string; place_of_birth: string; age: string
  postal_code: string; city: string
  driving_license_b: string // 'true' | 'false' | 'en_cours' | ''
  transport_means: string; psh_referral_request: string // 'true' | 'false' | ''
  // éducation
  school_level: string; school_justification: string
  // site(s) de formation — positionnement multi-sites
  training_sites: string[]
  // accompagnement
  france_travail: string; france_travail_agency: string
  mission_locale: string; mission_locale_city: string
  // immersion
  immersion_agreement: string // 'true' | 'false' | ''
  // parcours
  last_diploma: string; previous_trainings: string
  experiences: Experience[]
  // profil
  strengths_and_improvements: string
  french_level: string; english_level: string
  other_languages: string
  quality1: string; quality2: string; quality3: string
  defect1: string; defect2: string; defect3: string
  digital_skills: string
  ready_for_challenges: string; hobbies: string
  // projets pro
  career_objectives: string; desired_skills: string
  apprenticeship_motivation: string; training_expectations: string
  // compétences
  skills: { competence: string; level: SkillLevel }[]
  // infos poste
  domain_motivation: string; questions_concerns: string
  availability_date: string; geographic_mobility: Localisation[]
  weekend_work: string
  // secteurs et compétences attendues
  desired_sectors: string[]; expected_company_skills: string[]
  // découverte
  discovery_source: string
  // synthèse
  feasibility_conclusion: string; pathway_relevance: string
  special_needs: string; peda_reco: PedaReco
  other_recommendations: string; important_note: string; synthesis_location: string; synthesis_date: string
  candidate_signature: string // data-URL PNG de la signature de l'apprenti
}

function initForm(c: Candidate): FormState {
  const template = CANDIDATE_TEMPLATES[c.tp_type]
  const skills = c.skills_assessment && c.skills_assessment.length > 0
    ? c.skills_assessment.map(s => ({ competence: s.competence, level: s.level }))
    : template.defaultSkillsAssessment.map(s => ({ competence: s.competence, level: s.level }))

  return {
    tp_type: c.tp_type,
    tp_types: c.tp_types?.length ? c.tp_types : (c.tp_type ? [c.tp_type] : []),
    full_name: c.identity.full_name ?? '',
    email: c.identity.email ?? '',
    phone: c.identity.phone ?? '',
    date_of_birth: c.identity.date_of_birth ? c.identity.date_of_birth.slice(0, 10) : '',
    place_of_birth: c.identity.place_of_birth ?? '',
    age: c.identity.age != null ? String(c.identity.age) : '',
    postal_code: c.identity.postal_code ?? '',
    city: c.identity.city ?? '',
    driving_license_b: c.identity.driving_license_b == null ? '' : String(c.identity.driving_license_b),
    transport_means: c.identity.transport_means ?? '',
    psh_referral_request: c.identity.psh_referral_request == null ? '' : String(c.identity.psh_referral_request),
    school_level: c.education?.school_level ?? '',
    school_justification: c.education?.justification ?? '',
    training_sites: c.training_sites ?? (c.training_site ? [c.training_site] : []),
    france_travail: c.support?.france_travail_registered == null ? '' : String(c.support.france_travail_registered),
    france_travail_agency: c.support?.france_travail_agency ?? '',
    mission_locale: c.support?.mission_locale_registered == null ? '' : String(c.support.mission_locale_registered),
    mission_locale_city: c.support?.mission_locale_city ?? '',
    immersion_agreement: c.immersion_agreement == null ? '' : String(c.immersion_agreement),
    last_diploma: c.background?.last_diploma ?? '',
    previous_trainings: c.background?.previous_trainings ?? '',
    experiences: c.background?.professional_experiences?.map(e => ({
      position: e.position ?? '',
      duration: e.duration ?? '',
      responsibilities: e.responsibilities ?? '',
      company: e.company ?? '',
    })) ?? [],
    strengths_and_improvements: c.profile?.strengths_and_improvements ?? '',
    french_level: c.profile?.french_level != null ? String(c.profile.french_level) : '',
    english_level: c.profile?.english_level != null ? String(c.profile.english_level) : '',
    other_languages: c.profile?.other_languages?.join(', ') ?? '',
    quality1: c.profile?.qualities?.[0] ?? '',
    quality2: c.profile?.qualities?.[1] ?? '',
    quality3: c.profile?.qualities?.[2] ?? '',
    defect1: c.profile?.defects?.[0] ?? '',
    defect2: c.profile?.defects?.[1] ?? '',
    defect3: c.profile?.defects?.[2] ?? '',
    digital_skills: c.profile?.digital_skills?.join(', ') ?? '',
    ready_for_challenges: c.profile?.ready_for_challenges == null ? '' : String(c.profile.ready_for_challenges),
    hobbies: c.profile?.hobbies ?? '',
    career_objectives: c.professional_projects?.career_objectives ?? '',
    desired_skills: c.professional_projects?.desired_skills ?? '',
    apprenticeship_motivation: c.professional_projects?.apprenticeship_motivation ?? '',
    training_expectations: c.professional_projects?.training_expectations ?? '',
    skills,
    domain_motivation: c.job_info?.domain_motivation ?? '',
    questions_concerns: c.job_info?.questions_concerns ?? '',
    availability_date: c.job_info?.availability_date ? c.job_info.availability_date.slice(0, 10) : '',
    geographic_mobility: c.job_info?.geographic_mobility ?? [],
    weekend_work: c.job_info?.weekend_work == null ? '' : String(c.job_info.weekend_work),
    desired_sectors: c.desired_sectors ?? [],
    expected_company_skills: c.expected_company_skills ?? [],
    discovery_source: c.job_info?.discovery_source ?? '',
    feasibility_conclusion: c.synthesis?.feasibility_conclusion ?? '',
    pathway_relevance: c.synthesis?.pathway_relevance ?? '',
    special_needs: c.synthesis?.special_needs ?? '',
    peda_reco: {
      officeToolsReinforcement: c.synthesis?.pedagogical_recommendations?.office_tools_reinforcement ?? false,
      writtenCommunicationSupport: c.synthesis?.pedagogical_recommendations?.written_communication_support ?? false,
      oralConfidenceDevelopment: c.synthesis?.pedagogical_recommendations?.oral_confidence_development ?? false,
      timeManagementSupport: c.synthesis?.pedagogical_recommendations?.time_management_support ?? false,
      professionalPostureWork: c.synthesis?.pedagogical_recommendations?.professional_posture_work ?? false,
      enhancedCompanyImmersion: c.synthesis?.pedagogical_recommendations?.enhanced_company_immersion ?? false,
      pshSpecificSupport: c.synthesis?.pedagogical_recommendations?.psh_specific_support ?? false,
      individualFollowUp: c.synthesis?.pedagogical_recommendations?.individual_follow_up ?? false,
      languageTraining: c.synthesis?.pedagogical_recommendations?.language_training ?? false,
      stressManagementFollowUp: c.synthesis?.pedagogical_recommendations?.stress_management_follow_up ?? false,
    },
    other_recommendations: c.synthesis?.other_recommendations ?? '',
    important_note: c.synthesis?.important_note ?? '',
    synthesis_location: c.synthesis?.location ?? '',
    synthesis_date: c.synthesis?.date ? c.synthesis.date.slice(0, 10) : '',
    candidate_signature: c.synthesis?.candidate_signature ?? '',
  }
}

function toGqlInput(f: FormState) {
  const parseBool = (v: string) => v === 'true' ? true : v === 'false' ? false : undefined
  const qualities = [f.quality1, f.quality2, f.quality3].filter(Boolean)
  const defects = [f.defect1, f.defect2, f.defect3].filter(Boolean)
  const otherLanguages = f.other_languages ? f.other_languages.split(',').map(s => s.trim()).filter(Boolean) : []
  const digitalSkills = f.digital_skills ? f.digital_skills.split(',').map(s => s.trim()).filter(Boolean) : []

  return {
    tpType: f.tp_type,
    tpTypes: f.tp_types.length ? f.tp_types : undefined,
    trainingSites: f.training_sites,
    immersionAgreement: parseBool(f.immersion_agreement),
    desiredSectors: f.desired_sectors,
    expectedCompanySkills: f.expected_company_skills,
    identity: {
      fullName: f.full_name,
      email: f.email,
      phone: f.phone,
      dateOfBirth: f.date_of_birth || undefined,
      placeOfBirth: f.place_of_birth || undefined,
      age: f.age ? parseInt(f.age) : undefined,
      postalCode: f.postal_code || undefined,
      city: f.city || undefined,
      drivingLicenseB: parseBool(f.driving_license_b),
      transportMeans: f.transport_means || undefined,
      pshReferralRequest: parseBool(f.psh_referral_request),
    },
    education: {
      schoolLevel: f.school_level || undefined,
      justification: f.school_justification || undefined,
    },
    support: {
      franceTravailRegistered: parseBool(f.france_travail),
      franceTravailAgency: f.france_travail_agency || undefined,
      missionLocaleRegistered: parseBool(f.mission_locale),
      missionLocaleCity: f.mission_locale_city || undefined,
    },
    background: {
      lastDiploma: f.last_diploma || undefined,
      previousTrainings: f.previous_trainings || undefined,
      professionalExperiences: f.experiences.map(e => ({
        position: e.position || undefined,
        duration: e.duration || undefined,
        responsibilities: e.responsibilities || undefined,
        company: e.company || undefined,
      })),
    },
    profile: {
      strengthsAndImprovements: f.strengths_and_improvements || undefined,
      frenchLevel: f.french_level ? parseInt(f.french_level) : undefined,
      englishLevel: f.english_level ? parseInt(f.english_level) : undefined,
      otherLanguages: otherLanguages.length ? otherLanguages : undefined,
      qualities: qualities.length ? qualities : undefined,
      defects: defects.length ? defects : undefined,
      digitalSkills: digitalSkills.length ? digitalSkills : undefined,
      readyForChallenges: parseBool(f.ready_for_challenges),
      hobbies: f.hobbies || undefined,
    },
    professionalProjects: {
      careerObjectives: f.career_objectives || undefined,
      desiredSkills: f.desired_skills || undefined,
      apprenticeshipMotivation: f.apprenticeship_motivation || undefined,
      trainingExpectations: f.training_expectations || undefined,
    },
    skillsAssessment: f.skills.map(s => ({ competence: s.competence, level: s.level })),
    jobInfo: {
      domainMotivation: f.domain_motivation || undefined,
      questionsConcerns: f.questions_concerns || undefined,
      availabilityDate: f.availability_date || undefined,
      geographicMobility: f.geographic_mobility.length ? f.geographic_mobility : undefined,
      weekendWork: parseBool(f.weekend_work),
      discoverySource: f.discovery_source || undefined,
    },
    synthesis: {
      feasibilityConclusion: f.feasibility_conclusion || undefined,
      pathwayRelevance: f.pathway_relevance || undefined,
      specialNeeds: f.special_needs || undefined,
      pedagogicalRecommendations: f.peda_reco,
      otherRecommendations: f.other_recommendations || undefined,
      importantNote: f.important_note || undefined,
      location: f.synthesis_location || undefined,
      date: f.synthesis_date || undefined,
      candidateSignature: f.candidate_signature || undefined,
    },
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function RadioGroup({
  label, name, value, onChange, options,
}: {
  label: string; name: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
      <div className="flex flex-wrap gap-4">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 resize-none"
      />
    </div>
  )
}

function CheckGroup({ label, options, selected, onToggle, renderLabel }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; renderLabel?: (v: string) => string
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
              className="accent-blue-600 h-4 w-4 rounded"
            />
            <span className="text-sm text-gray-700">{renderLabel ? renderLabel(opt) : opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuestionnaireAB() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { candidate, loading, error } = useCandidateFull(id!)
  const token = useAuthStore((s) => s.token)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [driveStatus, setDriveStatus] = useState<string | null>(null)

  useEffect(() => {
    if (candidate) setForm(initForm(candidate))
  }, [candidate])

  const template = form ? CANDIDATE_TEMPLATES[form.tp_type] : null

  // Secteurs proposés : ceux de tous les TP du candidat, plus ceux déjà cochés
  // même s'ils ne sont plus au référentiel (aucune perte sur les fiches saisies).
  const sectorOptions: string[] = form
    ? Array.from(new Set([
        ...(form.tp_types.length ? form.tp_types : [form.tp_type])
          .flatMap(tp => CANDIDATE_TEMPLATES[tp]?.availableSectors ?? []),
        ...form.desired_sectors,
      ]))
    : []

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev)

  const toggleSector = (v: string) =>
    setForm(prev => {
      if (!prev) return prev
      const next = prev.desired_sectors.includes(v)
        ? prev.desired_sectors.filter(s => s !== v)
        : [...prev.desired_sectors, v]
      return { ...prev, desired_sectors: next }
    })

  const toggleSkill = (v: string) =>
    setForm(prev => {
      if (!prev) return prev
      const next = prev.expected_company_skills.includes(v)
        ? prev.expected_company_skills.filter(s => s !== v)
        : [...prev.expected_company_skills, v]
      return { ...prev, expected_company_skills: next }
    })

  const addExperience = () =>
    setForm(prev => prev ? { ...prev, experiences: [...prev.experiences, { position: '', duration: '', responsibilities: '', company: '' }] } : prev)

  const removeExperience = (i: number) =>
    setForm(prev => prev ? { ...prev, experiences: prev.experiences.filter((_, idx) => idx !== i) } : prev)

  const updateExperience = (i: number, field: keyof Experience, value: string) =>
    setForm(prev => {
      if (!prev) return prev
      const experiences = prev.experiences.map((e, idx) => idx === i ? { ...e, [field]: value } : e)
      return { ...prev, experiences }
    })

  const updateSkillLevel = (i: number, level: SkillLevel) =>
    setForm(prev => {
      if (!prev) return prev
      const skills = prev.skills.map((s, idx) => idx === i ? { ...s, level } : s)
      return { ...prev, skills }
    })

  const togglePeda = (key: keyof PedaReco) =>
    setForm(prev => prev ? { ...prev, peda_reco: { ...prev.peda_reco, [key]: !prev.peda_reco[key] } } : prev)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !id) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await candidateGraphqlClient.mutation(UPDATE_CANDIDATE_FULL, { id, input: toGqlInput(form) })
      if (result.error) throw new Error(result.error.message)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Enregistre automatiquement le résumé AB dans le Drive du candidat
      // (remplace l'AB précédent). Best-effort : n'empêche pas la sauvegarde.
      setDriveStatus('Enregistrement de l’AB dans le Drive…')
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${id}/ab-to-drive`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? 'échec')
        }
        setDriveStatus('AB enregistré dans le Drive ✓')
      } catch (e: any) {
        setDriveStatus(`AB non envoyé au Drive (${e.message ?? 'erreur'})`)
      }
      setTimeout(() => setDriveStatus(null), 5000)
    } catch (err: any) {
      setSaveError(err.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-r-transparent" />
      </div>
    )
  }

  if (error || !form || !template) {
    return (
      <div className="p-8 text-center text-sm text-red-500">
        {error ?? 'Candidat introuvable'}
      </div>
    )
  }

  const boolOpts = [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} /> Retour
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analyse du besoin – {form.full_name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {(form.tp_types.length ? form.tp_types : [form.tp_type]).map(t => TP_TYPE_LABELS[t]).join(' · ')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Identité */}
        <Section title="Identité du candidat">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="full_name" label="Nom et prénom" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            <InputField id="email" label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <InputField id="phone" label="Téléphone" value={form.phone} onChange={e => set('phone', e.target.value)} />
            <InputField id="date_of_birth" label="Date de naissance" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            <InputField id="place_of_birth" label="Lieu de naissance" value={form.place_of_birth} onChange={e => set('place_of_birth', e.target.value)} />
            <InputField id="age" label="Âge" type="number" value={form.age} onChange={e => set('age', e.target.value)} />
            <InputField id="postal_code" label="Code postal" value={form.postal_code} onChange={e => {
              const cp = e.target.value
              set('postal_code', cp)
              const city = cityFromPostalCode(cp)
              if (city) set('city', city)
            }} />
            <InputField id="city" label="Ville" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
        </Section>

        {/* 2. Situation personnelle */}
        <Section title="Situation personnelle">
          <RadioGroup
            label="Permis B"
            name="driving_license"
            value={form.driving_license_b}
            onChange={v => set('driving_license_b', v)}
            options={[...boolOpts, { value: 'en_cours', label: 'En cours' }]}
          />
          <InputField id="transport_means" label="Moyen de transport" value={form.transport_means} onChange={e => set('transport_means', e.target.value)} />
          <RadioGroup
            label="Souhaitez-vous être mis en relation avec notre Référent PSH ?"
            name="psh"
            value={form.psh_referral_request}
            onChange={v => set('psh_referral_request', v)}
            options={boolOpts}
          />
        </Section>

        {/* 3. Parcours et prérequis */}
        <Section title="Parcours et prérequis">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Niveau de formation</p>
            <div className="space-y-2">
              {template.schoolLevels.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="school_level"
                    value={opt.value}
                    checked={form.school_level === opt.value}
                    onChange={() => set('school_level', opt.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <InputField id="school_justification" label="Justificatif (si applicable)" value={form.school_justification} onChange={e => set('school_justification', e.target.value)} />
        </Section>

        {/* 4. Site(s) de formation — choix multiple */}
        <Section title="Positionnement sur les sites de formation">
          <p className="mb-2 text-sm text-gray-500">Plusieurs sites possibles.</p>
          <div className="space-y-2">
            {(Object.entries(TRAINING_SITE_LABELS) as [TrainingSite, string][]).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="training_sites"
                  value={value}
                  checked={form.training_sites.includes(value)}
                  onChange={() =>
                    set(
                      'training_sites',
                      form.training_sites.includes(value)
                        ? form.training_sites.filter((s) => s !== value)
                        : [...form.training_sites, value],
                    )
                  }
                  className="accent-blue-600 h-4 w-4"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* 5. Accompagnement */}
        <Section title="Accompagnement et dispositifs">
          <RadioGroup
            label="Inscrit à France Travail ?"
            name="france_travail"
            value={form.france_travail}
            onChange={v => set('france_travail', v)}
            options={boolOpts}
          />
          {form.france_travail === 'true' && (
            <InputField id="france_travail_agency" label="Agence France Travail" value={form.france_travail_agency} onChange={e => set('france_travail_agency', e.target.value)} />
          )}
          <RadioGroup
            label="Inscrit à la Mission Locale ?"
            name="mission_locale"
            value={form.mission_locale}
            onChange={v => set('mission_locale', v)}
            options={boolOpts}
          />
          {form.mission_locale === 'true' && (
            <InputField id="mission_locale_city" label="Ville de la Mission Locale" value={form.mission_locale_city} onChange={e => set('mission_locale_city', e.target.value)} />
          )}
        </Section>

        {/* 6. Immersion */}
        <Section title="Immersion professionnelle">
          <RadioGroup
            label="Accord pour réaliser une immersion en entreprise avant le contrat d'apprentissage ?"
            name="immersion"
            value={form.immersion_agreement}
            onChange={v => set('immersion_agreement', v)}
            options={boolOpts}
          />
        </Section>

        {/* 7. Parcours antérieures */}
        <Section title="Parcours antérieures">
          <InputField id="last_diploma" label="Dernier diplôme obtenu" value={form.last_diploma} onChange={e => set('last_diploma', e.target.value)} />
          <Textarea label="Formations suivies auparavant" value={form.previous_trainings} onChange={v => set('previous_trainings', v)} />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Expériences professionnelles</p>
              <button type="button" onClick={addExperience} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus size={14} /> Ajouter
              </button>
            </div>
            <div className="space-y-4">
              {form.experiences.map((exp, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4 relative">
                  <button type="button" onClick={() => removeExperience(i)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InputField id={`exp_position_${i}`} label="Poste occupé" value={exp.position} onChange={e => updateExperience(i, 'position', e.target.value)} />
                    <InputField id={`exp_company_${i}`} label="Entreprise" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                    <InputField id={`exp_duration_${i}`} label="Durée" value={exp.duration} onChange={e => updateExperience(i, 'duration', e.target.value)} />
                    <InputField id={`exp_resp_${i}`} label="Responsabilités" value={exp.responsibilities} onChange={e => updateExperience(i, 'responsibilities', e.target.value)} />
                  </div>
                </div>
              ))}
              {form.experiences.length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucune expérience ajoutée</p>
              )}
            </div>
          </div>
        </Section>

        {/* 8. Profil */}
        <Section title="Caractéristiques du profil">
          <Textarea label="Points forts et axes d'amélioration" value={form.strengths_and_improvements} onChange={v => set('strengths_and_improvements', v)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="french_level" label="Maîtrise du français (note /10)" type="number" min={1} max={10} value={form.french_level} onChange={e => set('french_level', e.target.value)} />
            {template.hasEnglishLevel && (
              <InputField id="english_level" label="Maîtrise de l'anglais (note /10)" type="number" min={1} max={10} value={form.english_level} onChange={e => set('english_level', e.target.value)} />
            )}
            <InputField id="other_languages" label="Autres langues maîtrisées (séparées par virgule)" value={form.other_languages} onChange={e => set('other_languages', e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Qualités (3 maximum)</p>
            <div className="grid grid-cols-3 gap-3">
              <InputField id="quality1" label="1" value={form.quality1} onChange={e => set('quality1', e.target.value)} />
              <InputField id="quality2" label="2" value={form.quality2} onChange={e => set('quality2', e.target.value)} />
              <InputField id="quality3" label="3" value={form.quality3} onChange={e => set('quality3', e.target.value)} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Défauts (3 maximum)</p>
            <div className="grid grid-cols-3 gap-3">
              <InputField id="defect1" label="1" value={form.defect1} onChange={e => set('defect1', e.target.value)} />
              <InputField id="defect2" label="2" value={form.defect2} onChange={e => set('defect2', e.target.value)} />
              <InputField id="defect3" label="3" value={form.defect3} onChange={e => set('defect3', e.target.value)} />
            </div>
          </div>
          <InputField id="digital_skills" label="Compétences numériques / logiciels (séparées par virgule)" value={form.digital_skills} onChange={e => set('digital_skills', e.target.value)} />
          <RadioGroup
            label="Prêt(e) à relever des défis et sortir de sa zone de confort ?"
            name="challenges"
            value={form.ready_for_challenges}
            onChange={v => set('ready_for_challenges', v)}
            options={boolOpts}
          />
          <Textarea label="Passions ou hobbies" value={form.hobbies} onChange={v => set('hobbies', v)} rows={2} />
        </Section>

        {/* 9. Projets professionnels */}
        <Section title="Projets professionnels">
          <Textarea label="Objectifs professionnels et postes / missions souhaités" value={form.career_objectives} onChange={v => set('career_objectives', v)} />
          <Textarea label="Compétences que vous souhaitez acquérir" value={form.desired_skills} onChange={v => set('desired_skills', v)} />
          <Textarea label="Motivations pour choisir un contrat en apprentissage" value={form.apprenticeship_motivation} onChange={v => set('apprenticeship_motivation', v)} />
          <Textarea label="Attentes vis-à-vis de la formation (contenu, accompagnement, suivi…)" value={form.training_expectations} onChange={v => set('training_expectations', v)} />
        </Section>

        {/* 10. Analyse des compétences */}
        <Section title="Analyse des compétences en début de formation">
          <p className="text-xs text-gray-400 mb-3">
            Acquis (A) / En cours d'acquisition (ECA) / Non acquis (NA) / Non évalué (NE)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 pr-4 text-left font-medium text-gray-700">Compétence professionnelle</th>
                  <th className="pb-2 w-44 text-left font-medium text-gray-700">Notation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {form.skills.map((skill, i) => (
                  <tr key={i} className="py-2">
                    <td className="py-3 pr-4 text-gray-700">{skill.competence}</td>
                    <td className="py-3">
                      <select
                        value={skill.level}
                        onChange={e => updateSkillLevel(i, e.target.value as SkillLevel)}
                        className="w-full rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      >
                        {Object.entries(SKILL_LEVEL_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{val} – {label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 11. Infos poste */}
        <Section title="Informations sur le poste / alternance">
          <Textarea label="Pourquoi avez-vous choisi ce domaine ?" value={form.domain_motivation} onChange={v => set('domain_motivation', v)} />
          <Textarea label="Questions / préoccupations concernant le déroulement de la formation" value={form.questions_concerns} onChange={v => set('questions_concerns', v)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="availability_date" label="Date de disponibilité pour commencer" type="date" value={form.availability_date} onChange={e => set('availability_date', e.target.value)} />
            <MultiSelectField
              id="geographic_mobility"
              label="Mobilité géographique"
              options={Object.values(Localisation)}
              value={form.geographic_mobility}
              onChange={vals => set('geographic_mobility', vals as Localisation[])}
              getOptionLabel={v => LOCALISATION_LABELS[v as Localisation]}
            />
          </div>
          <RadioGroup
            label="Travailler le week-end représente-t-il un inconvénient ?"
            name="weekend_work"
            value={form.weekend_work}
            onChange={v => set('weekend_work', v)}
            options={boolOpts}
          />
        </Section>

        {/* 12. Secteurs + compétences attendues */}
        <Section title="Secteurs d'activité et compétences attendues">
          <CheckGroup
            label="Secteurs d'activité souhaités"
            options={sectorOptions}
            selected={form.desired_sectors}
            onToggle={toggleSector}
            renderLabel={(s) => SECTOR_LABELS[s] ?? s}
          />
          <CheckGroup
            label="Compétences professionnelles attendues en entreprise"
            options={template.availableExpectedSkills}
            selected={form.expected_company_skills}
            onToggle={toggleSkill}
          />
        </Section>

        {/* 13. Découverte */}
        <Section title="Informations supplémentaires">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Comment avez-vous eu connaissance de notre établissement ?</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {Object.entries(DISCOVERY_SOURCE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discovery_source"
                    value={value}
                    checked={form.discovery_source === value}
                    onChange={() => set('discovery_source', value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* 14. Synthèse */}
        <Section title="Synthèse – à remplir par le/la chargé(e) de recrutement">
          <Textarea label="Conclusion sur la faisabilité" value={form.feasibility_conclusion} onChange={v => set('feasibility_conclusion', v)} />
          <Textarea label="Pertinence du parcours" value={form.pathway_relevance} onChange={v => set('pathway_relevance', v)} />
          <Textarea label="Besoins particuliers" value={form.special_needs} onChange={v => set('special_needs', v)} />

          <div>
            <p className="mb-3 text-sm font-medium text-gray-700">Préconisations pédagogiques</p>
            <div className="space-y-2">
              {([
                ['officeToolsReinforcement', 'Renforcement en bureautique et outils numériques'],
                ['writtenCommunicationSupport', 'Soutien en communication écrite'],
                ['oralConfidenceDevelopment', "Développement de la confiance à l'oral"],
                ['timeManagementSupport', 'Accompagnement en gestion du temps et organisation'],
                ['professionalPostureWork', 'Travail sur la posture professionnelle'],
                ['enhancedCompanyImmersion', 'Immersion renforcée en entreprise'],
                ['pshSpecificSupport', 'Accompagnement spécifique PSH'],
                ['individualFollowUp', 'Suivi individualisé'],
                ['languageTraining', 'Formation complémentaire en langue'],
                ['stressManagementFollowUp', 'Suivi sur la gestion du stress et la confiance en soi'],
              ] as [keyof PedaReco, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.peda_reco[key]}
                    onChange={() => togglePeda(key)}
                    className="accent-blue-600 h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <Textarea label="Autres préconisations" value={form.other_recommendations} onChange={v => set('other_recommendations', v)} />
          <Textarea label="Note importante" value={form.important_note} onChange={v => set('important_note', v)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="synthesis_location" label="Fait à" value={form.synthesis_location} onChange={e => set('synthesis_location', e.target.value)} />
            <InputField id="synthesis_date" label="Le" type="date" value={form.synthesis_date} onChange={e => set('synthesis_date', e.target.value)} />
          </div>
        </Section>

        {/* Signature de l'apprenti — toute fin du formulaire */}
        <Section title="Signature de l'apprenti">
          <SignaturePad
            value={form.candidate_signature}
            onChange={v => set('candidate_signature', v)}
            label="Signature de l'apprenti"
          />
        </Section>

        {/* Save bar */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-gray-100 -mx-4 px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle size={16} /> Sauvegardé
              </span>
            )}
            {driveStatus && <span className="text-xs text-gray-500">{driveStatus}</span>}
            {!saved && !saveError && !driveStatus && <span />}
          </div>
          <Button type="submit" isLoading={saving} leftIcon={<Save size={16} />}>
            Sauvegarder
          </Button>
        </div>

      </form>
    </div>
  )
}
