import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, User, MapPin, Car, Calendar, 
  X, Save, FileText, ClipboardCheck, Edit2, Plus, SlidersHorizontal, Trash2
} from 'lucide-react';
import { mockCandidates } from '@/data/mockCandidates';
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SkillLevel } from '@/types/candidate';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';

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

// --- Candidate Modal Component ---

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSave: (c: Candidate) => void;
  onUpdateStatus: (id: string, status: CandidateStatus) => void;
}

function CandidateModal({ candidate, onClose, onSave, onUpdateStatus }: CandidateModalProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Candidate>(structuredClone(candidate));
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const updateIdentity = (key: keyof Candidate['identity'], value: any) => {
    setFormData(prev => ({ ...prev, identity: { ...prev.identity, [key]: value } }));
  };

  const updateProfile = (key: keyof NonNullable<Candidate['profile']>, value: any) => {
    setFormData(prev => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-full bg-white rounded-2xl shadow-2xl flex flex-col animate-[fadeIn_0.2s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            {formData.identity.avatar_url ? (
              <img src={formData.identity.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-purple-light" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-light flex items-center justify-center text-purple ring-2 ring-purple/20">
                <User size={24} />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{formData.identity.full_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="relative group/badge">
                  <select
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    value={formData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as CandidateStatus;
                      setFormData(prev => ({ ...prev, status: newStatus }));
                      onUpdateStatus(candidate._id, newStatus);
                    }}
                  >
                    {Object.values(CandidateStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white shadow-sm group-hover/badge:opacity-90 transition-opacity ${getStatusColors(formData.status)}`}>
                    {formData.status}
                  </span>
                </div>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-md ring-1 inset-ring ${getTpTypeColors(formData.tp_type)}`}>
                  {formData.tp_type}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} leftIcon={<Edit2 size={16} />}>
                Modifier
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave} leftIcon={<Save size={16} />} className="bg-purple hover:bg-purple-dark text-white">
                Enregistrer
              </Button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button variant="secondary" leftIcon={<FileText size={16} className="text-purple" />}>
              Voir le CV
            </Button>
            <Button 
              variant="secondary" 
              leftIcon={<ClipboardCheck size={16} className="text-purple" />}
              onClick={() => navigate(`/rh/candidats/${candidate._id}/questionnaire`)}
            >
              Analyse de Besoin
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Section: Identité */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Identité & Contact</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Email</label>
                  {isEditing ? (
                    <input type="email" value={formData.identity.email} onChange={e => updateIdentity('email', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.identity.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Téléphone</label>
                  {isEditing ? (
                    <input type="text" value={formData.identity.phone} onChange={e => updateIdentity('phone', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.identity.phone}</p>
                  )}
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Âge</label>
                    {isEditing ? (
                      <input type="number" value={formData.identity.age || ''} onChange={e => updateIdentity('age', Number(e.target.value))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.identity.age ? `${formData.identity.age} ans` : '-'}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Ville</label>
                    {isEditing ? (
                      <input type="text" value={formData.identity.city || ''} onChange={e => updateIdentity('city', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.identity.city || '-'}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Permis B</label>
                  {isEditing ? (
                    <input type="checkbox" checked={formData.identity.driving_license_b || false} onChange={e => updateIdentity('driving_license_b', e.target.checked)} className="mt-1 rounded text-purple focus:ring-purple" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.identity.driving_license_b ? 'Oui' : 'Non'}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Formation & Parcours */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Formation & Parcours</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Niveau d'études</label>
                  {isEditing ? (
                    <select value={formData.education?.school_level || ''} onChange={e => setFormData(prev => ({ ...prev, education: { ...prev.education, school_level: e.target.value as SchoolLevel } }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20">
                      <option value="">Non renseigné</option>
                      {Object.values(SchoolLevel).map(level => <option key={level} value={level}>{level}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.education?.school_level || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Dernier diplôme</label>
                  {isEditing ? (
                    <input type="text" value={formData.background?.last_diploma || ''} onChange={e => setFormData(prev => ({ ...prev, background: { ...prev.background, last_diploma: e.target.value } }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.background?.last_diploma || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Secteur</label>
                  {isEditing ? (
                    <select value={formData.training_site || ''} onChange={e => setFormData(prev => ({ ...prev, training_site: e.target.value as TrainingSite }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20">
                      <option value="">Non renseigné</option>
                      {Object.values(TrainingSite).map(site => <option key={site} value={site}>{formatTrainingSite(site)}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formatTrainingSite(formData.training_site)}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Profil */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Profil & Compétences</h3>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Français (/5)</label>
                    {isEditing ? (
                      <input type="number" min="1" max="5" value={formData.profile?.french_level || ''} onChange={e => updateProfile('french_level', Number(e.target.value))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.profile?.french_level ? `${formData.profile.french_level}/5` : '-'}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Anglais (/5)</label>
                    {isEditing ? (
                      <input type="number" min="1" max="5" value={formData.profile?.english_level || ''} onChange={e => updateProfile('english_level', Number(e.target.value))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.profile?.english_level ? `${formData.profile.english_level}/5` : '-'}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Qualités</label>
                  {isEditing ? (
                    <input type="text" value={(formData.profile?.qualities || []).join(', ')} onChange={e => updateProfile('qualities', e.target.value.split(',').map(s => s.trim()))} placeholder="Séparées par des virgules" className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20" />
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.profile?.qualities?.map((q, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">{q}</span>
                      )) || '-'}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Projets professionnels */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Projets professionnels</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Objectifs de carrière</label>
                  {isEditing ? (
                    <textarea rows={2} value={formData.professional_projects?.career_objectives || ''} onChange={e => setFormData(prev => ({ ...prev, professional_projects: { ...prev.professional_projects, career_objectives: e.target.value } }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 resize-none" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.professional_projects?.career_objectives || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Motivation pour l'alternance</label>
                  {isEditing ? (
                    <textarea rows={2} value={formData.professional_projects?.apprenticeship_motivation || ''} onChange={e => setFormData(prev => ({ ...prev, professional_projects: { ...prev.professional_projects, apprenticeship_motivation: e.target.value } }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 resize-none" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.professional_projects?.apprenticeship_motivation || '-'}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Évaluation des compétences */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Évaluation des compétences</h3>
              <div className="space-y-3">
                 {!isEditing && (!formData.skills_assessment || formData.skills_assessment.length === 0) ? (
                    <p className="text-sm text-gray-500 italic">Aucune évaluation enregistrée.</p>
                 ) : (
                   <div className="space-y-2">
                     {formData.skills_assessment?.map((assessment, i) => (
                       <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                         <span className="text-sm font-medium text-gray-900">{assessment.competence}</span>
                         <span className="text-xs font-bold px-2 py-1 bg-white text-purple border border-purple/20 rounded-md">{assessment.level}</span>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </section>

            {/* Section: Synthèse */}
            <section className="space-y-4 md:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple border-b border-purple/10 pb-2">Synthèse</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Conclusion de faisabilité</label>
                  {isEditing ? (
                    <textarea rows={3} value={formData.synthesis?.feasibility_conclusion || ''} onChange={e => setFormData(prev => ({ ...prev, synthesis: { ...prev.synthesis, feasibility_conclusion: e.target.value } }))} className="mt-1 w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 resize-none" />
                  ) : (
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{formData.synthesis?.feasibility_conclusion || 'Aucune synthèse renseignée.'}</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- Main Page Component ---

export default function ListeCandidats() {
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const [search, setSearch] = useState('');
  
  // Filters state
  const [filterSite, setFilterSite] = useState<TrainingSite | ''>('');
  const [filterPermis, setFilterPermis] = useState<'all' | 'yes' | 'no'>('all');
  const [filterLevel, setFilterLevel] = useState<SchoolLevel | ''>('');
  const [filterMaxAge, setFilterMaxAge] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<CandidateStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      // Search
      if (search && !c.identity.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      // Filters
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
  }, [candidates, search, filterSite, filterPermis, filterLevel, filterMaxAge, filterStatus]);

  const handleUpdateCandidate = (updated: Candidate) => {
    setCandidates(prev => prev.map(c => c._id === updated._id ? updated : c));
  };

  const handleUpdateStatus = (id: string, newStatus: CandidateStatus) => {
    setCandidates(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
    if (selectedCandidate && selectedCandidate._id === id) {
      setSelectedCandidate(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const activeFiltersCount = [filterSite, filterLevel, filterStatus, filterMaxAge].filter(Boolean).length + (filterPermis !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setFilterSite('');
    setFilterPermis('all');
    setFilterLevel('');
    setFilterMaxAge('');
    setFilterStatus('');
  };

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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              showFilters || activeFiltersCount > 0 
                ? 'bg-purple-light text-purple ring-1 ring-purple/20' 
                : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-200 shadow-sm'
            }`}
          >
            <SlidersHorizontal size={16} />
            Filtres {activeFiltersCount > 0 && <span className="bg-purple text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1">{activeFiltersCount}</span>}
          </button>
          <Button className="bg-purple hover:bg-purple-dark text-white shadow-sm h-[42px]" leftIcon={<Plus size={18} />}>
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
              <select value={filterPermis} onChange={e => setFilterPermis(e.target.value as 'all'|'yes'|'no')} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
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
            onClick={() => setSelectedCandidate(candidate)}
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
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} className="text-gray-400" />
                  <span>{candidate.identity.age ? `${candidate.identity.age} ans` : 'Âge inconnu'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Car size={16} className="text-gray-400" />
                  <span>Permis B: {candidate.identity.driving_license_b ? 'Oui' : 'Non'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-gray-400" />
                  <span>{formatTrainingSite(candidate.training_site)}</span>
                </div>
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

      {/* Modal Render */}
      {selectedCandidate && (
        <CandidateModal 
          candidate={selectedCandidate} 
          onClose={() => setSelectedCandidate(null)} 
          onSave={handleUpdateCandidate} 
          onUpdateStatus={handleUpdateStatus}
        />
      )}

    </div>
  );
}
