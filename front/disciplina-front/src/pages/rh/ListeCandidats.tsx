import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, User, MapPin, Car, Calendar, Loader2, AlertCircle,
  X, Plus, SlidersHorizontal, Trash2,
  Phone, GraduationCap, Mail, Copy, Check, QrCode
} from 'lucide-react';
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel } from '@/types/candidate';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal';
import { splitFullName } from '@/utils/classmarker';
import { useCandidates, useCreateCandidate } from '@/graphql/hooks';

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

// --- Create Candidate Modal ---

interface CreateCandidateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateCandidateModal({ onClose, onCreated }: CreateCandidateModalProps) {
  const { createCandidate, result } = useCreateCandidate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    tpType: TitleProfessionalType.CC as string,
    status: 'SEEKING' as string,
    trainingSite: '' as string,
    schoolLevel: '' as string,
  });
  const [error, setError] = useState<string | null>(null);
  const [showClassMarker, setShowClassMarker] = useState(false);
  const splitName = splitFullName(form.fullName);
  const canGenerateLinks = splitName.first.length > 0 && splitName.last.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await createCandidate({
      tpType: form.tpType,
      status: form.status,
      identity: { fullName: form.fullName, email: form.email, phone: form.phone },
      education: { schoolLevel: form.schoolLevel || null },
      trainingSite: form.trainingSite || null,
    });
    if (res.error) { setError(res.error.message); return; }
    onCreated();
    onClose();
  };

  const field = (key: keyof typeof form) =>
    (val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-light flex items-center justify-center">
              <User size={18} className="text-purple" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Nouveau candidat</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-bg text-danger rounded-lg text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}
          <InputField
            id="cn-fullname"
            label="Nom complet *"
            placeholder="Ex: Jean Dupont"
            required
            value={form.fullName}
            onChange={e => field('fullName')(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              id="cn-email"
              label="Email *"
              type="email"
              placeholder="jean@example.com"
              required
              value={form.email}
              onChange={e => field('email')(e.target.value)}
            />
            <InputField
              id="cn-phone"
              label="Téléphone *"
              type="tel"
              placeholder="0692 XX XX XX"
              required
              value={form.phone}
              onChange={e => field('phone')(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cn-tptype" className="text-sm font-medium text-gray-700">Type TP *</label>
              <select
                id="cn-tptype"
                required
                value={form.tpType}
                onChange={e => field('tpType')(e.target.value)}
                className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
              >
                {Object.values(TitleProfessionalType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cn-status" className="text-sm font-medium text-gray-700">Statut *</label>
              <select
                id="cn-status"
                required
                value={form.status}
                onChange={e => field('status')(e.target.value)}
                className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
              >
                <option value="SEEKING">Recherche</option>
                <option value="NOT_SEEKING">Ne recherche pas</option>
                <option value="MATCHED">Immersion</option>
                <option value="CONTRACTED">Contrat</option>
                <option value="CANCELLED">Rupture</option>
                <option value="BANNED">Banni</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cn-site" className="text-sm font-medium text-gray-700">Secteur</label>
              <select
                id="cn-site"
                value={form.trainingSite}
                onChange={e => field('trainingSite')(e.target.value)}
                className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
              >
                <option value="">Non renseigné</option>
                <option value="NORD_SAINTE_MARIE">Nord</option>
                <option value="OUEST_SAINT_PAUL">Ouest</option>
                <option value="SUD_SAINT_PIERRE">Sud</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cn-level" className="text-sm font-medium text-gray-700">Niveau d'études</label>
              <select
                id="cn-level"
                value={form.schoolLevel}
                onChange={e => field('schoolLevel')(e.target.value)}
                className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
              >
                <option value="">Non renseigné</option>
                {Object.values(SchoolLevel).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
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
            <Button
              type="submit"
              isLoading={result.fetching}
              className="bg-purple hover:bg-purple-dark text-white"
              leftIcon={<Plus size={16} />}
            >
              Créer le candidat
            </Button>
          </div>
        </form>
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
