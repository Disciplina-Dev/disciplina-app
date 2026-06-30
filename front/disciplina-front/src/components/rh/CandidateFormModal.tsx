import { useState, useEffect, useRef } from 'react';
import { User, X, AlertCircle, Plus, Trash2, QrCode } from 'lucide-react';
import { TitleProfessionalType, TrainingSite, SkillLevel, SchoolLevel, Localisation, CandidateStatus } from '@/types/candidate';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import MultiSelectField from '@/components/ui/MultiSelectField';
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal';
import { splitFullName } from '@/utils/classmarker';
import { candidateGraphqlClient } from '@/graphql/client';
import { CREATE_CANDIDATE, UPDATE_CANDIDATE_FULL, CHECK_CANDIDATE_EMAIL } from '@/graphql/queries';
import { cityFromPostalCode, LOCALISATION_LABELS } from '@/data/reunionCommunes';
import { computeAge } from '@/utils/age';
import { CANDIDATE_TEMPLATES, SKILL_LEVEL_LABELS, DISCOVERY_SOURCE_LABELS, TRAINING_SITE_LABELS } from '@/data/candidateTemplates';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus';
import SignaturePad from '@/components/ui/SignaturePad';

// ─── Form helpers ───────────────────────────────────────────────────────────

function ABSectionTitle({ title }: { title: string }) {
  return (
    <div className="border-t border-gray-100 pt-5 pb-1">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

function ABRadio({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-4">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="radio" name={name} value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} className="accent-blue-600" />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ABTextarea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 resize-none" />
    </div>
  );
}

function ABSelectField({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors">
        {children}
      </select>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

type ABForm = {
  // identité
  dateOfBirth: string; placeOfBirth: string; departmentOfBirth: string; age: string;
  fullName: string; socialSecurityNumber: string; email: string; phone: string;
  address: string; postalCode: string; city: string;
  drivingLicenseB: string; transportMeans: string; pshReferralRequest: string;
  hadApprenticeshipContract: string;
  apprenticeshipContractDetails: string;
  // TP (multi) + statut
  tpTypes: TitleProfessionalType[]; status: string;
  // éducation
  schoolLevel: string; schoolJustification: string;
  // site
  trainingSites: string[];
  // accompagnement
  franceTravail: string; franceTravailAgency: string;
  missionLocale: string; missionLocaleCity: string;
  // immersion
  immersionAgreement: string;
  // parcours
  lastDiploma: string; previousTrainings: string;
  experiences: { position: string; duration: string; responsibilities: string; company: string }[];
  // profil
  strengthsAndImprovements: string;
  frenchLevel: string; englishLevel: string; otherLanguages: string;
  quality1: string; quality2: string; quality3: string;
  defect1: string; defect2: string; defect3: string;
  digitalSkills: string; readyForChallenges: string; hobbies: string;
  // projets pro
  careerObjectives: string; desiredSkills: string;
  apprenticeshipMotivation: string; trainingExpectations: string;
  // compétences
  skills: { competence: string; level: SkillLevel }[];
  // infos poste
  domainMotivation: string; questionsConcerns: string;
  availabilityDate: string; geographicMobility: Localisation[]; weekendWork: string;
  // secteurs + compétences attendues
  desiredSectors: string[]; expectedCompanySkills: string[];
  // découverte
  discoverySource: string;
  // signature de l'apprenti (data-URL PNG)
  candidateSignature: string;
};

// Union des compétences des templates de plusieurs TP (dédupliquée par nom).
function defaultSkillsForTps(tps: TitleProfessionalType[]): { competence: string; level: SkillLevel }[] {
  const seen = new Set<string>()
  const out: { competence: string; level: SkillLevel }[] = []
  for (const tp of tps) {
    for (const s of CANDIDATE_TEMPLATES[tp]?.defaultSkillsAssessment ?? []) {
      if (!seen.has(s.competence)) {
        seen.add(s.competence)
        out.push({ competence: s.competence, level: s.level })
      }
    }
  }
  return out
}

// Réconcilie les compétences quand la sélection de TP change :
// garde celles encore requises (niveau saisi préservé), ajoute les nouvelles
// manquantes, retire celles propres à un TP décoché (non partagées).
function reconcileSkills(
  prev: { competence: string; level: SkillLevel }[],
  nextTps: TitleProfessionalType[],
): { competence: string; level: SkillLevel }[] {
  const required = defaultSkillsForTps(nextTps)
  const requiredNames = new Set(required.map(s => s.competence))
  const kept = prev.filter(s => requiredNames.has(s.competence))
  const keptNames = new Set(kept.map(s => s.competence))
  const added = required.filter(s => !keptNames.has(s.competence))
  return [...kept, ...added]
}

function emptyABForm(tpType: TitleProfessionalType = TitleProfessionalType.CC): ABForm {
  const tpl = CANDIDATE_TEMPLATES[tpType];
  return {
    dateOfBirth: '', placeOfBirth: '', departmentOfBirth: '', age: '', address: '', postalCode: '', city: '',
    fullName: '', socialSecurityNumber: '', email: '', phone: '',
    drivingLicenseB: '', transportMeans: '', pshReferralRequest: '',
    hadApprenticeshipContract: '', apprenticeshipContractDetails: '',
    tpTypes: [tpType], status: 'SEEKING',
    schoolLevel: '', schoolJustification: '',
    trainingSites: [],
    franceTravail: '', franceTravailAgency: '',
    missionLocale: '', missionLocaleCity: '',
    immersionAgreement: '',
    lastDiploma: '', previousTrainings: '', experiences: [],
    strengthsAndImprovements: '',
    frenchLevel: '', englishLevel: '', otherLanguages: '',
    quality1: '', quality2: '', quality3: '',
    defect1: '', defect2: '', defect3: '',
    digitalSkills: '', readyForChallenges: '', hobbies: '',
    careerObjectives: '', desiredSkills: '', apprenticeshipMotivation: '', trainingExpectations: '',
    skills: tpl.defaultSkillsAssessment.map(s => ({ competence: s.competence, level: s.level })),
    domainMotivation: '', questionsConcerns: '', availabilityDate: '', geographicMobility: [], weekendWork: '',
    desiredSectors: [], expectedCompanySkills: [],
    discoverySource: '',
    candidateSignature: '',
  };
}

/** Pré-remplit le formulaire à partir d'un candidat existant (mode édition). */
function candidateToForm(c: Candidate): ABForm {
  const tpTypes = c.tp_types?.length ? c.tp_types : [c.tp_type];
  const skills = c.skills_assessment && c.skills_assessment.length > 0
    ? c.skills_assessment.map(s => ({ competence: s.competence, level: s.level }))
    : defaultSkillsForTps(tpTypes);
  const bs = (b?: boolean | null) => (b == null ? '' : String(b));
  // candidate.status est une valeur d'enum (ex: "Recherche") → clé (ex: "SEEKING")
  const statusKey = (Object.entries(CandidateStatus).find(([, v]) => v === c.status)?.[0]) ?? String(c.status);

  return {
    fullName: c.identity.full_name ?? '',
    socialSecurityNumber: c.identity.social_security_number ?? '',
    email: c.identity.email ?? '',
    phone: c.identity.phone ?? '',
    dateOfBirth: c.identity.date_of_birth ? c.identity.date_of_birth.slice(0, 10) : '',
    placeOfBirth: c.identity.place_of_birth ?? '',
    departmentOfBirth: c.identity.department_of_birth ?? '',
    age: c.identity.age != null ? String(c.identity.age) : '',
    address: c.identity.address ?? '',
    postalCode: c.identity.postal_code ?? '',
    city: c.identity.city ?? '',
    drivingLicenseB: bs(c.identity.driving_license_b),
    transportMeans: c.identity.transport_means ?? '',
    pshReferralRequest: bs(c.identity.psh_referral_request),
    hadApprenticeshipContract: bs(c.identity.had_apprenticeship_contract),
    apprenticeshipContractDetails: c.identity.apprenticeship_contract_details ?? '',
    tpTypes,
    status: statusKey,
    schoolLevel: c.education?.school_level ?? '',
    schoolJustification: c.education?.justification ?? '',
    trainingSites: c.training_sites ?? (c.training_site ? [c.training_site] : []),
    franceTravail: bs(c.support?.france_travail_registered),
    franceTravailAgency: c.support?.france_travail_agency ?? '',
    missionLocale: bs(c.support?.mission_locale_registered),
    missionLocaleCity: c.support?.mission_locale_city ?? '',
    immersionAgreement: bs(c.immersion_agreement),
    lastDiploma: c.background?.last_diploma ?? '',
    previousTrainings: c.background?.previous_trainings ?? '',
    experiences: c.background?.professional_experiences?.map(e => ({
      position: e.position ?? '',
      duration: e.duration ?? '',
      responsibilities: e.responsibilities ?? '',
      company: e.company ?? '',
    })) ?? [],
    strengthsAndImprovements: c.profile?.strengths_and_improvements ?? '',
    frenchLevel: c.profile?.french_level != null ? String(c.profile.french_level) : '',
    englishLevel: c.profile?.english_level != null ? String(c.profile.english_level) : '',
    otherLanguages: c.profile?.other_languages?.join(', ') ?? '',
    quality1: c.profile?.qualities?.[0] ?? '',
    quality2: c.profile?.qualities?.[1] ?? '',
    quality3: c.profile?.qualities?.[2] ?? '',
    defect1: c.profile?.defects?.[0] ?? '',
    defect2: c.profile?.defects?.[1] ?? '',
    defect3: c.profile?.defects?.[2] ?? '',
    digitalSkills: c.profile?.digital_skills?.join(', ') ?? '',
    readyForChallenges: bs(c.profile?.ready_for_challenges),
    hobbies: c.profile?.hobbies ?? '',
    careerObjectives: c.professional_projects?.career_objectives ?? '',
    desiredSkills: c.professional_projects?.desired_skills ?? '',
    apprenticeshipMotivation: c.professional_projects?.apprenticeship_motivation ?? '',
    trainingExpectations: c.professional_projects?.training_expectations ?? '',
    skills,
    domainMotivation: c.job_info?.domain_motivation ?? '',
    questionsConcerns: c.job_info?.questions_concerns ?? '',
    availabilityDate: c.job_info?.availability_date ? c.job_info.availability_date.slice(0, 10) : '',
    geographicMobility: c.job_info?.geographic_mobility ?? [],
    weekendWork: bs(c.job_info?.weekend_work),
    desiredSectors: c.desired_sectors ?? [],
    expectedCompanySkills: c.expected_company_skills ?? [],
    discoverySource: c.job_info?.discovery_source ?? '',
    candidateSignature: c.synthesis?.candidate_signature ?? '',
  };
}

function toServerInput(f: ABForm) {
  const pb = (v: string) => v === 'true' ? true : v === 'false' ? false : undefined;
  const qualities = [f.quality1, f.quality2, f.quality3].filter(Boolean);
  const defects = [f.defect1, f.defect2, f.defect3].filter(Boolean);
  return {
    tpType: f.tpTypes[0], tpTypes: f.tpTypes, status: f.status,
    trainingSites: f.trainingSites,
    immersionAgreement: pb(f.immersionAgreement),
    desiredSectors: f.desiredSectors,
    expectedCompanySkills: f.expectedCompanySkills,
    identity: {
      fullName: f.fullName, socialSecurityNumber: f.socialSecurityNumber || undefined, email: f.email, phone: f.phone,
      dateOfBirth: f.dateOfBirth || undefined,
      placeOfBirth: f.placeOfBirth || undefined,
      departmentOfBirth: f.departmentOfBirth || undefined,
      age: f.age ? parseInt(f.age) : undefined,
      address: f.address || undefined,
      postalCode: f.postalCode || undefined,
      city: f.city || undefined,
      drivingLicenseB: pb(f.drivingLicenseB),
      transportMeans: f.transportMeans || undefined,
      pshReferralRequest: pb(f.pshReferralRequest),
      hadApprenticeshipContract: pb(f.hadApprenticeshipContract),
      apprenticeshipContractDetails: f.hadApprenticeshipContract === 'true' ? (f.apprenticeshipContractDetails || undefined) : undefined,
    },
    education: { schoolLevel: f.schoolLevel || undefined, justification: f.schoolJustification || undefined },
    support: {
      franceTravailRegistered: pb(f.franceTravail),
      franceTravailAgency: f.franceTravailAgency || undefined,
      missionLocaleRegistered: pb(f.missionLocale),
      missionLocaleCity: f.missionLocaleCity || undefined,
    },
    background: {
      lastDiploma: f.lastDiploma || undefined,
      previousTrainings: f.previousTrainings || undefined,
      professionalExperiences: f.experiences,
    },
    profile: {
      strengthsAndImprovements: f.strengthsAndImprovements || undefined,
      frenchLevel: f.frenchLevel ? parseInt(f.frenchLevel) : undefined,
      englishLevel: f.englishLevel ? parseInt(f.englishLevel) : undefined,
      otherLanguages: f.otherLanguages ? f.otherLanguages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      qualities: qualities.length ? qualities : undefined,
      defects: defects.length ? defects : undefined,
      digitalSkills: f.digitalSkills ? f.digitalSkills.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      readyForChallenges: pb(f.readyForChallenges),
      hobbies: f.hobbies || undefined,
    },
    professionalProjects: {
      careerObjectives: f.careerObjectives || undefined,
      desiredSkills: f.desiredSkills || undefined,
      apprenticeshipMotivation: f.apprenticeshipMotivation || undefined,
      trainingExpectations: f.trainingExpectations || undefined,
    },
    skillsAssessment: f.skills,
    jobInfo: {
      domainMotivation: f.domainMotivation || undefined,
      questionsConcerns: f.questionsConcerns || undefined,
      availabilityDate: f.availabilityDate || undefined,
      geographicMobility: f.geographicMobility.length ? f.geographicMobility : undefined,
      weekendWork: pb(f.weekendWork),
      discoverySource: f.discoverySource || undefined,
    },
    synthesis: { candidateSignature: f.candidateSignature || undefined },
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface CandidateFormModalProps {
  /** Si fourni → mode édition (pré-rempli + mutation update). Sinon → création. */
  candidate?: Candidate;
  /** Valeurs pré-remplies en création (ex: depuis un entretien du calendrier). */
  prefill?: { fullName?: string; email?: string; phone?: string };
  onClose: () => void;
  onSaved: () => void;
  /** Appelé après création avec l'id du nouveau candidat (ex: pour rediriger vers sa fiche). */
  onCreated?: (id: string) => void;
}

export default function CandidateFormModal({ candidate, prefill, onClose, onSaved, onCreated }: CandidateFormModalProps) {
  const isEdit = !!candidate;
  const [form, setForm] = useState<ABForm>(() =>
    candidate ? candidateToForm(candidate) : { ...emptyABForm(), ...prefill },
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClassMarker, setShowClassMarker] = useState(false);
  // Doublon email détecté en direct (autre fiche que celle en cours d'édition).
  const [emailDup, setEmailDup] = useState<{ fullName: string } | null>(null);
  const splitName = splitFullName(form.fullName);
  const canGenerateLinks = splitName.first.length > 0 && splitName.last.length > 0;

  // Template fusionné sur tous les TP cochés (options = union, anglais = si au moins un).
  const selectedTps = form.tpTypes.length ? form.tpTypes : [TitleProfessionalType.CC];
  const primaryTp = selectedTps[0];
  const uniq = (a: string[]) => [...new Set(a)];
  const schoolLevelsMerged = (() => {
    const seen = new Set<string>();
    const out: { value: SchoolLevel; label: string }[] = [];
    for (const tp of selectedTps)
      for (const o of CANDIDATE_TEMPLATES[tp]?.schoolLevels ?? [])
        if (!seen.has(o.value)) { seen.add(o.value); out.push(o); }
    return out;
  })();
  const template = {
    hasEnglishLevel: selectedTps.some(tp => CANDIDATE_TEMPLATES[tp]?.hasEnglishLevel),
    schoolLevels: schoolLevelsMerged,
    availableSectors: uniq(selectedTps.flatMap(tp => CANDIDATE_TEMPLATES[tp]?.availableSectors ?? [])),
    availableExpectedSkills: uniq(selectedTps.flatMap(tp => CANDIDATE_TEMPLATES[tp]?.availableExpectedSkills ?? [])),
  };
  const boolOpts = [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }];

  // Quand la sélection de TP change → réconcilie les compétences (préserve les
  // niveaux saisis, ajoute les manquantes, retire celles d'un TP décoché).
  // Ne touche plus à schoolLevel / secteurs : aucune perte d'info.
  const didMount = useRef(false);
  const tpKey = form.tpTypes.join(',');
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setForm(prev => ({ ...prev, skills: reconcileSkills(prev.skills, prev.tpTypes) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpKey]);

  // Vérifie en direct (débounce 400 ms) si une fiche existe déjà pour cet email.
  useEffect(() => {
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailDup(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await candidateGraphqlClient.query(
          CHECK_CANDIDATE_EMAIL,
          { email },
          { requestPolicy: 'network-only' },
        );
        const r = res.data?.candidateByEmail;
        // Ignore la fiche en cours d'édition (son propre email).
        setEmailDup(r?.exists && r.id !== candidate?._id ? { fullName: r.fullName } : null);
      } catch {
        setEmailDup(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.email, candidate?._id]);

  const set = <K extends keyof ABForm>(key: K, val: ABForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const toggleSector = (v: string) =>
    setForm(prev => ({
      ...prev,
      desiredSectors: prev.desiredSectors.includes(v)
        ? prev.desiredSectors.filter(s => s !== v)
        : [...prev.desiredSectors, v],
    }));

  const toggleSkill = (v: string) =>
    setForm(prev => ({
      ...prev,
      expectedCompanySkills: prev.expectedCompanySkills.includes(v)
        ? prev.expectedCompanySkills.filter(s => s !== v)
        : [...prev.expectedCompanySkills, v],
    }));

  const addExp = () =>
    setForm(prev => ({ ...prev, experiences: [...prev.experiences, { position: '', duration: '', responsibilities: '', company: '' }] }));

  const removeExp = (i: number) =>
    setForm(prev => ({ ...prev, experiences: prev.experiences.filter((_, idx) => idx !== i) }));

  const updateExp = (i: number, field: string, val: string) =>
    setForm(prev => ({ ...prev, experiences: prev.experiences.map((e, idx) => idx === i ? { ...e, [field]: val } : e) }));

  const updateSkillLevel = (i: number, level: SkillLevel) =>
    setForm(prev => ({ ...prev, skills: prev.skills.map((s, idx) => idx === i ? { ...s, level } : s) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const input = toServerInput(form);
    try {
      const result = isEdit
        ? await candidateGraphqlClient.mutation(UPDATE_CANDIDATE_FULL, { id: candidate!._id, input })
        : await candidateGraphqlClient.mutation(CREATE_CANDIDATE, { input });
      if (result.error) throw new Error(result.error.message.replace(/^\[GraphQL\]\s*/, ''));
      onSaved();
      if (!isEdit) {
        const newId = result.data?.createCandidate?.id;
        if (newId && onCreated) onCreated(newId);
      }
      onClose();
    } catch (err: any) {
      setError(err.message ?? (isEdit ? 'Erreur lors de la modification' : 'Erreur lors de la création'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] animate-[fadeIn_0.2s_ease-out]">

        {/* Header fixe */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-light flex items-center justify-center">
              <User size={18} className="text-purple" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEdit ? 'Modifier la fiche candidat' : 'Analyse du besoin – Nouveau candidat'}
              </h2>
              <p className="text-xs text-gray-400">Remplissez les champs correspondant au profil</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Corps scrollable */}
        <form id="ab-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-bg text-danger rounded-lg text-sm">
              <AlertCircle size={16} className="shrink-0" />{error}
            </div>
          )}

          {/* Type(s) TP (multi) + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type(s) TP *</label>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {Object.values(TitleProfessionalType).map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600 h-4 w-4"
                      checked={form.tpTypes.includes(t)}
                      onChange={() => {
                        const has = form.tpTypes.includes(t);
                        if (has && form.tpTypes.length === 1) return; // garder au moins un TP
                        set('tpTypes', has ? form.tpTypes.filter(x => x !== t) : [...form.tpTypes, t]);
                      }}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <ABSelectField id="cn-status" label="Statut *" value={form.status} onChange={v => set('status', v)}>
              {CANDIDATE_STATUS_ORDER.map(s => (
                <option key={s} value={s}>{CANDIDATE_STATUS_LABELS[s]}</option>
              ))}
            </ABSelectField>
          </div>

          {/* Identité */}
          <ABSectionTitle title="Identité du candidat" />
          <InputField id="cn-fullname" label="Nom et prénom *" placeholder="Ex: Jean Dupont" required value={form.fullName} onChange={e => set('fullName', e.target.value)} />
          <InputField id="cn-ssn" label="Numéro de sécurité sociale" placeholder="Ex: 1 85 12 75 116 001 23" value={form.socialSecurityNumber} onChange={e => set('socialSecurityNumber', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <InputField id="cn-email" label="Email *" type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
              {emailDup && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} className="shrink-0" />
                  Une fiche candidat est déjà enregistrée pour cet email ({emailDup.fullName}).
                </p>
              )}
            </div>
            <InputField id="cn-phone" label="Téléphone *" type="tel" required value={form.phone} onChange={e => set('phone', e.target.value)} />
            <InputField id="cn-dob" label="Date de naissance" type="date" value={form.dateOfBirth} onChange={e => {
              const dob = e.target.value;
              set('dateOfBirth', dob);
              const age = computeAge(dob);
              set('age', age != null ? String(age) : '');
            }} />
            {/* <InputField id="cn-pob" label="Lieu de naissance" value={form.placeOfBirth} onChange={e => set('placeOfBirth', e.target.value)} /> */}
            <AddressAutocomplete id="cn-pob" label="Lieu de naissance" value={form.placeOfBirth} onChange={v => set('placeOfBirth', v)} apiEndpoint="/api/sourcing/completion" />
            <AddressAutocomplete id="cn-dob-dept" label="Département de naissance" value={form.departmentOfBirth} onChange={v => set('departmentOfBirth', v)} apiEndpoint="/api/sourcing/departement" />
            <InputField id="cn-age" label="Âge (auto)" type="number" value={form.age} disabled className="bg-gray-50 text-gray-500" />
            <div className="col-span-2">
              <AddressAutocomplete id="cn-address" label="Adresse (numéro et rue)" value={form.address} onChange={v => set('address', v)} apiEndpoint="/api/sourcing/completion" />
            </div>
            <InputField id="cn-cp" label="Code postal" value={form.postalCode} onChange={e => {
              const cp = e.target.value;
              set('postalCode', cp);
              const city = cityFromPostalCode(cp);
              if (city) set('city', city);
            }} />
            <InputField id="cn-city" label="Ville" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>

          {/* Situation personnelle */}
          <ABSectionTitle title="Situation personnelle" />
          <ABRadio label="Permis B" name="driv" value={form.drivingLicenseB} onChange={v => set('drivingLicenseB', v)}
            options={[...boolOpts, { value: 'en_cours', label: 'En cours' }]} />
          <InputField id="cn-transport" label="Moyen de transport" value={form.transportMeans} onChange={e => set('transportMeans', e.target.value)} />
          <ABRadio label="Souhait de mise en relation avec le Référent PSH ?" name="psh" value={form.pshReferralRequest} onChange={v => set('pshReferralRequest', v)} options={boolOpts} />
          <ABRadio label="A déjà eu un contrat d'apprentissage ?" name="appr" value={form.hadApprenticeshipContract} onChange={v => set('hadApprenticeshipContract', v)} options={boolOpts} />
          {form.hadApprenticeshipContract === 'true' && (
            <ABTextarea label="Précisez le contrat d'apprentissage (entreprise, période, métier…)" value={form.apprenticeshipContractDetails} onChange={v => set('apprenticeshipContractDetails', v)} />
          )}

          {/* Prérequis */}
          <ABSectionTitle title="Parcours et prérequis" />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Niveau de formation</p>
            <div className="space-y-2">
              {template.schoolLevels.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="schoolLevel" value={opt.value} checked={form.schoolLevel === opt.value} onChange={() => set('schoolLevel', opt.value)} className="accent-blue-600" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <InputField id="cn-justif" label="Justificatif" value={form.schoolJustification} onChange={e => set('schoolJustification', e.target.value)} />

          {/* Site(s) de formation — choix multiple */}
          <ABSectionTitle title="Site de formation DISCIPLINA" />
          <div className="space-y-2">
            {(Object.entries(TRAINING_SITE_LABELS) as [TrainingSite, string][]).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="site"
                  value={val}
                  checked={form.trainingSites.includes(val)}
                  onChange={() =>
                    set(
                      'trainingSites',
                      form.trainingSites.includes(val)
                        ? form.trainingSites.filter((s) => s !== val)
                        : [...form.trainingSites, val],
                    )
                  }
                  className="accent-blue-600 h-4 w-4"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Accompagnement */}
          <ABSectionTitle title="Accompagnement et dispositifs" />
          <ABRadio label="Inscrit à France Travail ?" name="ft" value={form.franceTravail} onChange={v => set('franceTravail', v)} options={boolOpts} />
          {form.franceTravail === 'true' && <InputField id="cn-fta" label="Agence France Travail" value={form.franceTravailAgency} onChange={e => set('franceTravailAgency', e.target.value)} />}
          <ABRadio label="Inscrit à la Mission Locale ?" name="ml" value={form.missionLocale} onChange={v => set('missionLocale', v)} options={boolOpts} />
          {form.missionLocale === 'true' && <InputField id="cn-mlc" label="Ville Mission Locale" value={form.missionLocaleCity} onChange={e => set('missionLocaleCity', e.target.value)} />}

          {/* Immersion */}
          <ABSectionTitle title="Immersion professionnelle" />
          <ABRadio label="Accord pour une immersion avant le contrat ?" name="imm" value={form.immersionAgreement} onChange={v => set('immersionAgreement', v)} options={boolOpts} />

          {/* Parcours antérieures */}
          <ABSectionTitle title="Parcours antérieures" />
          <InputField id="cn-diploma" label="Dernier diplôme obtenu" value={form.lastDiploma} onChange={e => set('lastDiploma', e.target.value)} />
          <ABTextarea label="Formations suivies auparavant" value={form.previousTrainings} onChange={v => set('previousTrainings', v)} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Expériences professionnelles</p>
              <button type="button" onClick={addExp} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {form.experiences.map((exp, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3 relative">
                  <button type="button" onClick={() => removeExp(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  <div className="grid grid-cols-2 gap-2">
                    <InputField id={`ep${i}pos`} label="Poste" value={exp.position} onChange={e => updateExp(i, 'position', e.target.value)} />
                    <InputField id={`ep${i}co`} label="Entreprise" value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} />
                    <InputField id={`ep${i}du`} label="Durée" value={exp.duration} onChange={e => updateExp(i, 'duration', e.target.value)} />
                    <InputField id={`ep${i}re`} label="Responsabilités" value={exp.responsibilities} onChange={e => updateExp(i, 'responsibilities', e.target.value)} />
                  </div>
                </div>
              ))}
              {form.experiences.length === 0 && <p className="text-xs text-gray-400 italic">Aucune expérience ajoutée</p>}
            </div>
          </div>

          {/* Profil */}
          <ABSectionTitle title="Caractéristiques du profil" />
          <ABTextarea label="Points forts et axes d'amélioration" value={form.strengthsAndImprovements} onChange={v => set('strengthsAndImprovements', v)} />
          <div className="grid grid-cols-2 gap-3">
            <InputField id="cn-fr" label="Français /10" type="number" min={1} max={10} value={form.frenchLevel} onChange={e => set('frenchLevel', e.target.value)} />
            {template.hasEnglishLevel && <InputField id="cn-en" label="Anglais /10" type="number" min={1} max={10} value={form.englishLevel} onChange={e => set('englishLevel', e.target.value)} />}
            <InputField id="cn-langs" label="Autres langues (virgule)" value={form.otherLanguages} onChange={e => set('otherLanguages', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InputField id="q1" label="Qualité 1" value={form.quality1} onChange={e => set('quality1', e.target.value)} />
            <InputField id="q2" label="Qualité 2" value={form.quality2} onChange={e => set('quality2', e.target.value)} />
            <InputField id="q3" label="Qualité 3" value={form.quality3} onChange={e => set('quality3', e.target.value)} />
            <InputField id="d1" label="Défaut 1" value={form.defect1} onChange={e => set('defect1', e.target.value)} />
            <InputField id="d2" label="Défaut 2" value={form.defect2} onChange={e => set('defect2', e.target.value)} />
            <InputField id="d3" label="Défaut 3" value={form.defect3} onChange={e => set('defect3', e.target.value)} />
          </div>
          <InputField id="cn-digit" label="Compétences numériques (virgule)" value={form.digitalSkills} onChange={e => set('digitalSkills', e.target.value)} />
          <ABRadio label="Prêt(e) à relever des défis ?" name="chall" value={form.readyForChallenges} onChange={v => set('readyForChallenges', v)} options={boolOpts} />
          <ABTextarea label="Hobbies / passions" value={form.hobbies} onChange={v => set('hobbies', v)} rows={1} />

          {/* Projets pro */}
          <ABSectionTitle title="Projets professionnels" />
          <ABTextarea label="Objectifs professionnels" value={form.careerObjectives} onChange={v => set('careerObjectives', v)} />
          <ABTextarea label="Compétences souhaitées" value={form.desiredSkills} onChange={v => set('desiredSkills', v)} />
          <ABTextarea label="Motivations pour l'apprentissage" value={form.apprenticeshipMotivation} onChange={v => set('apprenticeshipMotivation', v)} />
          <ABTextarea label="Attentes vis-à-vis de la formation" value={form.trainingExpectations} onChange={v => set('trainingExpectations', v)} />

          {/* Compétences */}
          <ABSectionTitle title="Analyse des compétences" />
          <p className="text-xs text-gray-400">A = Acquis · ECA = En cours · NA = Non acquis · NE = Non évalué</p>
          <div className="space-y-2">
            {form.skills.map((skill, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 flex-1">{skill.competence}</span>
                <select value={skill.level} onChange={e => updateSkillLevel(i, e.target.value as SkillLevel)}
                  className="w-36 shrink-0 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                  {Object.entries(SKILL_LEVEL_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{val} – {lbl}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Infos poste */}
          <ABSectionTitle title="Informations sur le poste" />
          <ABTextarea label="Pourquoi ce domaine ?" value={form.domainMotivation} onChange={v => set('domainMotivation', v)} />
          <ABTextarea label="Questions / préoccupations" value={form.questionsConcerns} onChange={v => set('questionsConcerns', v)} />
          <div className="grid grid-cols-2 gap-3">
            <InputField id="cn-avail" label="Date de disponibilité" type="date" value={form.availabilityDate} onChange={e => set('availabilityDate', e.target.value)} />
            <MultiSelectField
              id="cn-mob"
              label="Mobilité géographique"
              options={Object.values(Localisation)}
              value={form.geographicMobility}
              onChange={vals => set('geographicMobility', vals as Localisation[])}
              getOptionLabel={v => LOCALISATION_LABELS[v as Localisation]}
            />
          </div>
          <ABRadio label="Travailler le week-end est un inconvénient ?" name="wknd" value={form.weekendWork} onChange={v => set('weekendWork', v)} options={boolOpts} />

          {/* Secteurs + compétences attendues */}
          <ABSectionTitle title="Secteurs d'activité et compétences attendues" />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Secteurs souhaités</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {template.availableSectors.map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={form.desiredSectors.includes(s)} onChange={() => toggleSector(s)} className="accent-blue-600 h-4 w-4" />{s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Compétences attendues en entreprise</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {template.availableExpectedSkills.map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={form.expectedCompanySkills.includes(s)} onChange={() => toggleSkill(s)} className="accent-blue-600 h-4 w-4" />{s}
                </label>
              ))}
            </div>
          </div>

          {/* Découverte */}
          <ABSectionTitle title="Comment a-t-il connu DISCIPLINA ?" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(DISCOVERY_SOURCE_LABELS).map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="radio" name="discovery" value={val} checked={form.discoverySource === val} onChange={() => set('discoverySource', val)} className="accent-blue-600" />{lbl}
              </label>
            ))}
          </div>

          {/* Signature de l'apprenti — toute fin */}
          <ABSectionTitle title="Signature de l'apprenti" />
          <SignaturePad
            value={form.candidateSignature}
            onChange={v => set('candidateSignature', v)}
            label="Signature de l'apprenti"
          />

        </form>

        {/* Footer fixe */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canGenerateLinks}
            onClick={() => setShowClassMarker(true)}
            leftIcon={<QrCode size={16} />}
            title={canGenerateLinks ? '' : 'Renseigner prénom et nom'}
          >
            Générer les liens de test
          </Button>
          <Button form="ab-form" type="submit" isLoading={loading} disabled={!!emailDup} className="bg-purple hover:bg-purple-dark text-white" leftIcon={<Plus size={16} />}>
            {isEdit ? 'Enregistrer les modifications' : 'Créer le candidat'}
          </Button>
        </div>

      </div>
      {showClassMarker && (
        <ClassMarkerLinksModal
          open={showClassMarker}
          onClose={() => setShowClassMarker(false)}
          firstName={splitName.first}
          lastName={splitName.last}
          tpType={primaryTp as TitleProfessionalType}
        />
      )}
    </div>
  );
}
