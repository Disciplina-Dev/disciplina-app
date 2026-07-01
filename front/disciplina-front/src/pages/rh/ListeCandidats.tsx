import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, User, MapPin, Car, Calendar, Loader2, AlertCircle,
  Plus, SlidersHorizontal, Trash2,
  Phone, GraduationCap, Mail, Copy, Check, Camera
} from 'lucide-react';
import WebcamCaptureModal from '@/components/rh/WebcamCaptureModal';
import CandidateFormModal from '@/components/rh/CandidateFormModal';
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SCHOOL_LEVEL_LABELS } from '@/types/candidate';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';
import { useCandidatesPage, type CandidateServerFilters } from '@/graphql/hooks';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_BADGE_CLASS } from '@/constants/candidateStatus';

// --- Helpers ---

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

const PAGE_SIZE = 25;

function toServerFilters(filters: {
  trainingSite: TrainingSite | '';
  status: CandidateStatus | '';
  schoolLevel: SchoolLevel | '';
  permis: 'all' | 'yes' | 'no';
  ageMin: number | '';
  ageMax: number | '';
  tpType: TitleProfessionalType | '';
}): CandidateServerFilters | undefined {
  const serverFilters: CandidateServerFilters = {
    trainingSite: filters.trainingSite || undefined,
    status: filters.status || undefined,
    schoolLevel: filters.schoolLevel || undefined,
    drivingLicenseB: filters.permis === 'all' ? undefined : filters.permis === 'yes',
    ageMin: filters.ageMin || undefined,
    ageMax: filters.ageMax || undefined,
    tpType: filters.tpType || undefined,
  };
  const hasAny = Object.values(serverFilters).some(v => v !== undefined);
  return hasAny ? serverFilters : undefined;
}

// --- Main Page Component ---

export default function ListeCandidats() {
  const navigate = useNavigate();
  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capturePhotoFor, setCapturePhotoFor] = useState<Candidate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters state
  const [filterSite, setFilterSite] = useState<TrainingSite | ''>('');
  const [filterPermis, setFilterPermis] = useState<'all' | 'yes' | 'no'>('all');
  const [filterLevel, setFilterLevel] = useState<SchoolLevel | ''>('');
  const [filterMinAge, setFilterMinAge] = useState<number | ''>('');
  const [filterMaxAge, setFilterMaxAge] = useState<number | ''>('');
  const [filterTpType, setFilterTpType] = useState<TitleProfessionalType | ''>('');
  const [filterStatus, setFilterStatus] = useState<CandidateStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce the search input before sending it to the server
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setAfterCursor(undefined);
      setCursorHistory([]);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset pagination whenever a filter changes
  useEffect(() => {
    setAfterCursor(undefined);
    setCursorHistory([]);
  }, [filterSite, filterPermis, filterLevel, filterMinAge, filterMaxAge, filterTpType, filterStatus]);

  const serverFilters = useMemo(
    () => toServerFilters({ trainingSite: filterSite, status: filterStatus, schoolLevel: filterLevel, permis: filterPermis, ageMin: filterMinAge, ageMax: filterMaxAge, tpType: filterTpType }),
    [filterSite, filterStatus, filterLevel, filterPermis, filterMinAge, filterMaxAge, filterTpType],
  );

  const { candidates, pageInfo, loading, error, refetch } = useCandidatesPage(PAGE_SIZE, afterCursor, debouncedSearch || undefined, serverFilters);
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);

  // Sync server candidates into local state (enables optimistic edits)
  useMemo(() => { setLocalCandidates(candidates); }, [candidates]);

  const handleUpdateStatus = (id: string, newStatus: CandidateStatus) => {
    setLocalCandidates(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
  };

  const activeFiltersCount = [filterSite, filterLevel, filterStatus, filterMinAge, filterMaxAge, filterTpType].filter(Boolean).length + (filterPermis !== 'all' ? 1 : 0);
  const hidePagination = !!debouncedSearch;

  const handleResetFilters = () => {
    setFilterSite('');
    setFilterPermis('all');
    setFilterLevel('');
    setFilterMinAge('');
    setFilterMaxAge('');
    setFilterTpType('');
    setFilterStatus('');
  };

  const loadNextPage = () => {
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) return;
    setCursorHistory(h => [...h, afterCursor]);
    setAfterCursor(pageInfo.endCursor);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadPrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prev = cursorHistory[cursorHistory.length - 1];
    setCursorHistory(h => h.slice(0, -1));
    setAfterCursor(prev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {localCandidates.length} candidat{localCandidates.length !== 1 ? 's' : ''} trouvé{localCandidates.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">

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
                {Object.values(CandidateStatus).map(status => <option key={status} value={status}>{CANDIDATE_STATUS_LABELS[status]}</option>)}
              </select>
            </div>

            {/* Niveau BAC */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Niveau d'études</label>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as SchoolLevel)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="">Tous les niveaux</option>
                {Object.values(SchoolLevel).map(level => <option key={level} value={level}>{SCHOOL_LEVEL_LABELS[level]}</option>)}
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

            {/* Type TP */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Type TP</label>
              <select value={filterTpType} onChange={e => setFilterTpType(e.target.value as TitleProfessionalType)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none">
                <option value="">Tous les types</option>
                {Object.values(TitleProfessionalType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            {/* Age Min */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Âge min</label>
              <input
                type="number"
                placeholder="Ex: 18"
                value={filterMinAge}
                onChange={e => setFilterMinAge(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              />
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
        {localCandidates.map(candidate => (
          <div
            key={candidate._id}
            onClick={() => navigate(`/rh/candidats/${candidate._id}`)}
            className="group relative bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple/30 transition-all cursor-pointer flex flex-col h-full overflow-hidden"
          >
            {/* Status Corner Badge */}
            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer z-10 ${CANDIDATE_STATUS_BADGE_CLASS[candidate.status]}`}>
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
                  <option key={status} value={status}>{CANDIDATE_STATUS_LABELS[status]}</option>
                ))}
              </select>
              {CANDIDATE_STATUS_LABELS[candidate.status]}
            </div>

            {/* Card Header: Avatar */}
            <div className="mb-4 mt-2">
              <div className="relative w-14 h-14">
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
                <button
                  title="Prendre une photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCapturePhotoFor(candidate);
                  }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple text-white flex items-center justify-center ring-2 ring-white hover:bg-purple/90"
                >
                  <Camera size={12} />
                </button>
              </div>
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

                {(candidate.created_at || candidate.owner?.name) && (
                  <div className="pt-3 mt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                    {candidate.created_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="shrink-0" />
                        Créé le {new Date(candidate.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {candidate.owner?.name && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <User size={12} className="shrink-0" />
                        <span className="truncate">par {candidate.owner.name}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {localCandidates.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
            <User size={48} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-900">Aucun candidat trouvé</p>
            <p className="text-sm">Essayez de modifier votre recherche ou vos filtres.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!hidePagination && (
        <div className="mt-8 flex items-center justify-between rounded-xl bg-white border border-gray-100 px-5 py-4 shadow-sm">
          <button
            type="button"
            onClick={loadPrevPage}
            disabled={cursorHistory.length === 0 || loading}
            className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Page précédente
          </button>
          <button
            type="button"
            onClick={loadNextPage}
            disabled={!pageInfo?.hasNextPage || loading}
            className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Page suivante →
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CandidateFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => refetch()}
        />
      )}

      {capturePhotoFor && (
        <WebcamCaptureModal
          candidateId={capturePhotoFor._id}
          candidateName={capturePhotoFor.identity.full_name}
          onClose={() => setCapturePhotoFor(null)}
          onUploaded={(updatedAt) => {
            const cid = capturePhotoFor._id;
            const url = `${import.meta.env.VITE_API_URL}/api/candidates/${cid}/avatar?v=${encodeURIComponent(updatedAt)}`;
            setLocalCandidates((prev) =>
              prev.map((c) =>
                c._id === cid
                  ? { ...c, identity: { ...c.identity, avatar_updated_at: updatedAt, avatar_url: url } }
                  : c,
              ),
            );
          }}
        />
      )}

    </div>
  );
}
