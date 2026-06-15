import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, User, MapPin, Car, Calendar, Loader2, AlertCircle,
  X, Plus, SlidersHorizontal, Trash2,
  Phone, GraduationCap, Mail, Copy, Check, QrCode
} from 'lucide-react';
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SkillLevel } from '@/types/candidate';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';
import MultiSelectField from '@/components/ui/MultiSelectField';
import { cityFromPostalCode, NORTH_MOBILITY_COMMUNES } from '@/data/reunionCommunes';
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal';
import { splitFullName } from '@/utils/classmarker';
import { useCandidates } from '@/graphql/hooks';
import { candidateGraphqlClient } from '@/graphql/client';
import { CREATE_CANDIDATE } from '@/graphql/queries';
import { CANDIDATE_TEMPLATES, SKILL_LEVEL_LABELS, DISCOVERY_SOURCE_LABELS, TRAINING_SITE_LABELS } from '@/data/candidateTemplates';

// --- Helpers ---

const getStatusColors = (status: CandidateStatus) => {
  switch (status) {
    case CandidateStatus.SEEKING:
      return 'bg-blue';
    case CandidateStatus.MATCHED:
      return 'bg-purple';
    case CandidateStatus.CONTRACTED:
      return 'bg-success';
    case CandidateStatus.NOT_SEEKING:
      return 'bg-gray-500';
    case CandidateStatus.CANCELLED:
      return 'bg-warning';
    case CandidateStatus.BANNED:
      return 'bg-danger';
    default:
      return 'bg-gray-400';
  }
};

const getTpTypeColors = (tpType: TitleProfessionalType) => {
  switch (tpType) {
    case TitleProfessionalType.AD:
      // Teal
      return 'bg-[#CCFBF1] text-[#0F766E] ring-[#0F766E]/20';
    case TitleProfessionalType.CC:
      // Indigo
      return 'bg-[#E0E7FF] text-[#4338CA] ring-[#4338CA]/20';
    case TitleProfessionalType.NTC:
      // Fuchsia
      return 'bg-[#FAE8FF] text-[#A21CAF] ring-[#A21CAF]/20';
    case TitleProfessionalType.REM:
      // Lime
      return 'bg-[#ECFCCB] text-[#4D7C0F] ring-[#4D7C0F]/20';
    case TitleProfessionalType.SA:
      // Slate
      return 'bg-[#F1F5F9] text-[#334155] ring-[#334155]/20';
    default:
      return 'bg-gray-100 text-gray-500 ring-gray-200';
  }
};

const formatTrainingSite = (site?: TrainingSite) => {
  if (!site) return 'Non renseigné';
  if (site === TrainingSite.NORD_SAINTE_MARIE) return 'Nord';
  if (site === TrainingSite.OUEST_SAINT_PAUL) return 'Ouest';
  if (site === TrainingSite.SUD_SAINT_PIERRE) return 'Sud';
  return site;
};

// --- Main Page Component ---

// --- Create Candidate Modal (AB complet) ---

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

interface CreateCandidateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type ABForm = {
  // identité
  fullName: string; email: string; phone: string;
  dateOfBirth: string; placeOfBirth: string; age: string;
  postalCode: string; city: string;
  drivingLicenseB: string; transportMeans: string; pshReferralRequest: string;
  // TP + statut
  tpType: TitleProfessionalType; status: string;
  // éducation
  schoolLevel: string; schoolJustification: string;
  // site
  trainingSite: string;
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
  availabilityDate: string; geographicMobility: string; weekendWork: string;
  // secteurs + compétences attendues
  desiredSectors: string[]; expectedCompanySkills: string[];
  // découverte
  discoverySource: string;
};

function emptyABForm(tpType: TitleProfessionalType = TitleProfessionalType.CC): ABForm {
  const tpl = CANDIDATE_TEMPLATES[tpType];
  return {
    fullName: '', email: '', phone: '',
    dateOfBirth: '', placeOfBirth: '', age: '', postalCode: '', city: '',
    drivingLicenseB: '', transportMeans: '', pshReferralRequest: '',
    tpType, status: 'SEEKING',
    schoolLevel: '', schoolJustification: '',
    trainingSite: '',
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
    domainMotivation: '', questionsConcerns: '', availabilityDate: '', geographicMobility: '', weekendWork: '',
    desiredSectors: [], expectedCompanySkills: [],
    discoverySource: '',
  };
}

function toCreateInput(f: ABForm) {
  const pb = (v: string) => v === 'true' ? true : v === 'false' ? false : undefined;
  const qualities = [f.quality1, f.quality2, f.quality3].filter(Boolean);
  const defects = [f.defect1, f.defect2, f.defect3].filter(Boolean);
  return {
    tpType: f.tpType, status: f.status,
    trainingSite: f.trainingSite || undefined,
    immersionAgreement: pb(f.immersionAgreement),
    desiredSectors: f.desiredSectors,
    expectedCompanySkills: f.expectedCompanySkills,
    identity: {
      fullName: f.fullName, email: f.email, phone: f.phone,
      dateOfBirth: f.dateOfBirth || undefined,
      placeOfBirth: f.placeOfBirth || undefined,
      age: f.age ? parseInt(f.age) : undefined,
      postalCode: f.postalCode || undefined,
      city: f.city || undefined,
      drivingLicenseB: pb(f.drivingLicenseB),
      transportMeans: f.transportMeans || undefined,
      pshReferralRequest: pb(f.pshReferralRequest),
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
      geographicMobility: f.geographicMobility || undefined,
      weekendWork: pb(f.weekendWork),
      discoverySource: f.discoverySource || undefined,
    },
  };
}

function CreateCandidateModal({ onClose, onCreated }: CreateCandidateModalProps) {
  const [form, setForm] = useState<ABForm>(() => emptyABForm());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClassMarker, setShowClassMarker] = useState(false);
  const splitName = splitFullName(form.fullName);
  const canGenerateLinks = splitName.first.length > 0 && splitName.last.length > 0;

  const template = CANDIDATE_TEMPLATES[form.tpType];
  const boolOpts = [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }];

  // Quand tpType change → reset skills + secteurs
  useEffect(() => {
    const tpl = CANDIDATE_TEMPLATES[form.tpType];
    setForm(prev => ({
      ...prev,
      schoolLevel: '',
      desiredSectors: [],
      expectedCompanySkills: [],
      skills: tpl.defaultSkillsAssessment.map(s => ({ competence: s.competence, level: s.level })),
    }));
  }, [form.tpType]);

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
    const input = toCreateInput(form);
    try {
      const result = await candidateGraphqlClient.mutation(CREATE_CANDIDATE, { input });
      if (result.error) throw new Error(result.error.message);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la création');
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
              <h2 className="text-lg font-bold text-gray-900">Analyse du besoin – Nouveau candidat</h2>
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

          {/* Type TP + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <ABSelectField id="cn-tp" label="Type TP *" value={form.tpType} onChange={v => set('tpType', v as TitleProfessionalType)}>
              {Object.values(TitleProfessionalType).map(t => <option key={t} value={t}>{t}</option>)}
            </ABSelectField>
            <ABSelectField id="cn-status" label="Statut *" value={form.status} onChange={v => set('status', v)}>
              <option value="SEEKING">Recherche</option>
              <option value="NOT_SEEKING">Ne recherche pas</option>
              <option value="MATCHED">Immersion</option>
              <option value="CONTRACTED">Contrat</option>
              <option value="CANCELLED">Rupture</option>
              <option value="BANNED">Banni</option>
            </ABSelectField>
          </div>

          {/* Identité */}
          <ABSectionTitle title="Identité du candidat" />
          <InputField id="cn-fullname" label="Nom et prénom *" placeholder="Ex: Jean Dupont" required value={form.fullName} onChange={e => set('fullName', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <InputField id="cn-email" label="Email *" type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
            <InputField id="cn-phone" label="Téléphone *" type="tel" required value={form.phone} onChange={e => set('phone', e.target.value)} />
            <InputField id="cn-dob" label="Date de naissance" type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
            <InputField id="cn-pob" label="Lieu de naissance" value={form.placeOfBirth} onChange={e => set('placeOfBirth', e.target.value)} />
            <InputField id="cn-age" label="Âge" type="number" value={form.age} onChange={e => set('age', e.target.value)} />
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

          {/* Site de formation */}
          <ABSectionTitle title="Site de formation DISCIPLINA" />
          <div className="space-y-2">
            {(Object.entries(TRAINING_SITE_LABELS) as [TrainingSite, string][]).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="radio" name="site" value={val} checked={form.trainingSite === val} onChange={() => set('trainingSite', val)} className="accent-blue-600" />
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
              options={NORTH_MOBILITY_COMMUNES}
              value={form.geographicMobility ? form.geographicMobility.split(',').map(s => s.trim()).filter(Boolean) : []}
              onChange={vals => set('geographicMobility', vals.join(', '))}
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
          <Button form="ab-form" type="submit" isLoading={loading} className="bg-purple hover:bg-purple-dark text-white" leftIcon={<Plus size={16} />}>
            Créer le candidat
          </Button>
        </div>

      </div>
      {showClassMarker && (
        <ClassMarkerLinksModal
          open={showClassMarker}
          onClose={() => setShowClassMarker(false)}
          firstName={splitName.first}
          lastName={splitName.last}
          tpType={form.tpType as TitleProfessionalType}
        />
      )}
    </div>
  );
}

// --- Main Page Component ---

export default function ListeCandidats() {
  const navigate = useNavigate();
  const { candidates, loading, error, refetch } = useCandidates();
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Sync server candidates into local state (enables optimistic edits)
  useMemo(() => { setLocalCandidates(candidates); }, [candidates]);

  // Filters state
  const [filterSite, setFilterSite] = useState<TrainingSite | ''>('');
  const [filterPermis, setFilterPermis] = useState<'all' | 'yes' | 'no'>('all');
  const [filterLevel, setFilterLevel] = useState<SchoolLevel | ''>('');
  const [filterMaxAge, setFilterMaxAge] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<CandidateStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCandidates = useMemo(() => {
    return localCandidates.filter(c => {
      if (search && !c.identity.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterSite && c.training_site !== filterSite) return false;
      if (filterLevel && c.education?.school_level !== filterLevel) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterMaxAge && c.identity.age && c.identity.age > filterMaxAge) return false;
      if (filterPermis !== 'all') {
        const hasPermis = !!c.identity.driving_license_b;
        if (filterPermis === 'yes' && !hasPermis) return false;
        if (filterPermis === 'no' && hasPermis) return false;
      }
      return true;
    });
  }, [localCandidates, search, filterSite, filterPermis, filterLevel, filterMaxAge, filterStatus]);

  const handleUpdateStatus = (id: string, newStatus: CandidateStatus) => {
    setLocalCandidates(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
  };

  const activeFiltersCount = [filterSite, filterLevel, filterStatus, filterMaxAge].filter(Boolean).length + (filterPermis !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setFilterSite('');
    setFilterPermis('all');
    setFilterLevel('');
    setFilterMaxAge('');
    setFilterStatus('');
  };

  // Loading state
  if (loading && localCandidates.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 size={40} className="animate-spin text-purple" />
          <p className="text-sm font-medium">Chargement des candidats…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && localCandidates.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-danger-bg flex items-center justify-center">
            <AlertCircle size={24} className="text-danger" />
          </div>
          <p className="font-semibold text-gray-900">Impossible de charger les candidats</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Button variant="secondary" onClick={() => refetch()}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 sm:p-8">

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Candidats</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredCandidates.length} candidat{filteredCandidates.length !== 1 ? 's' : ''} trouvé{filteredCandidates.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple shadow-sm transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || activeFiltersCount > 0
                ? 'bg-purple-light text-purple ring-1 ring-purple/20'
                : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-200 shadow-sm'
              }`}
          >
            <SlidersHorizontal size={16} />
            Filtres {activeFiltersCount > 0 && <span className="bg-purple text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1">{activeFiltersCount}</span>}
          </button>
          <Button
            id="btn-nouveau-candidat"
            className="bg-purple hover:bg-purple-dark text-white shadow-sm h-[42px]"
            leftIcon={<Plus size={18} />}
            onClick={() => setShowCreateModal(true)}
          >
            Nouveau
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] animate-[fadeIn_0.15s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">

            {/* Secteur */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Secteur</label>
              <select value={filterSite} onChange={e => setFilterSite(e.target.value as TrainingSite)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="">Tous les secteurs</option>
                {Object.values(TrainingSite).map(site => <option key={site} value={site}>{formatTrainingSite(site)}</option>)}
              </select>
            </div>

            {/* Statut */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Statut</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CandidateStatus)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="">Tous les statuts</option>
                {Object.values(CandidateStatus).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            {/* Niveau BAC */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Niveau d'études</label>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as SchoolLevel)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="">Tous les niveaux</option>
                {Object.values(SchoolLevel).map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>

            {/* Permis B */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Permis B</label>
              <select value={filterPermis} onChange={e => setFilterPermis(e.target.value as 'all' | 'yes' | 'no')} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="all">Indifférent</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </div>

            {/* Age Max */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Âge max</label>
              <input
                type="number"
                placeholder="Ex: 25"
                value={filterMaxAge}
                onChange={e => setFilterMaxAge(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              />
            </div>

          </div>

          {activeFiltersCount > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:text-pink-dark transition-colors"
              >
                <Trash2 size={14} />
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCandidates.map(candidate => (
          <div
            key={candidate._id}
            onClick={() => navigate(`/rh/candidats/${candidate._id}`)}
            className="group relative bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple/30 transition-all cursor-pointer flex flex-col h-full overflow-hidden"
          >
            {/* Status Corner Badge */}
            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer z-10 ${getStatusColors(candidate.status)}`}>
              <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                value={candidate.status}
                onChange={(e) => {
                  e.stopPropagation();
                  handleUpdateStatus(candidate._id, e.target.value as CandidateStatus);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {Object.values(CandidateStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {candidate.status}
            </div>

            {/* Card Header: Avatar */}
            <div className="mb-4 mt-2">
              {candidate.identity.avatar_url ? (
                <img
                  src={candidate.identity.avatar_url}
                  alt={candidate.identity.full_name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-50 group-hover:ring-purple-light transition-all"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-purple-light flex items-center justify-center text-purple ring-2 ring-gray-50 group-hover:ring-purple-light transition-all">
                  <User size={24} />
                </div>
              )}
            </div>

            {/* Card Body: Info */}
            <div className="mb-4 flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-purple transition-colors">
                {candidate.identity.full_name}
              </h3>
              <div className="mb-4 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ring-1 inset-ring ${getTpTypeColors(candidate.tp_type)}`}>
                  {candidate.tp_type}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={16} className="text-gray-400 shrink-0" />
                  {candidate.identity.email ? (
                    <>
                      <span className="truncate flex-1">{candidate.identity.email}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(candidate.identity.email);
                          setCopiedId(candidate._id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className={`p-1 rounded transition-all flex items-center justify-center ${
                          copiedId === candidate._id
                            ? 'text-success bg-success/10 opacity-100'
                            : 'md:opacity-0 focus:opacity-100 group-hover:opacity-100 text-gray-400 hover:text-purple hover:bg-purple-light'
                        }`}
                        title="Copier l'email"
                      >
                        {copiedId === candidate._id ? (
                          <Check size={14} className="animate-[ping__.3s_ease-in-out_1]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="truncate flex-1">-</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={16} className="text-gray-400 shrink-0" />
                  <span className="truncate">{candidate.identity.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GraduationCap size={16} className="text-gray-400 shrink-0" />
                  <span className="truncate">{candidate.education?.school_level || candidate.background?.last_diploma || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2 shrink-0">
                    <Calendar size={16} className="text-gray-400 shrink-0" />
                    <span>{candidate.identity.age ? `${candidate.identity.age} ans` : '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={16} className="text-gray-400 shrink-0" />
                    <span className="truncate">{candidate.identity.city || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Car size={16} className="text-gray-400 shrink-0" />
                  <span>Permis B: {candidate.identity.driving_license_b ? 'Oui' : 'Non'}</span>
                </div>

                {candidate.profile?.qualities && candidate.profile.qualities.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {candidate.profile.qualities.slice(0, 3).map((q, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-md whitespace-nowrap truncate max-w-full">
                        {q}
                      </span>
                    ))}
                    {candidate.profile.qualities.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[11px] font-medium rounded-md whitespace-nowrap">
                        +{candidate.profile.qualities.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredCandidates.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
            <User size={48} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-900">Aucun candidat trouvé</p>
            <p className="text-sm">Essayez de modifier votre recherche ou vos filtres.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCandidateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => refetch()}
        />
      )}

    </div>
  );
}
