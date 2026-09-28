import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconAlert, IconCalendar, IconCamera, IconCar, IconCheck, IconCopy, IconLoader, IconMail, IconMapPin, IconPhone, IconPlus, IconSliders, IconTraining, IconTrash, IconUser } from '@/components/ui/icons'
import WebcamCaptureModal from '@/components/rh/WebcamCaptureModal';
import CandidateAvatar from '@/components/rh/CandidateAvatar';
import CandidateQuickCreateModal from '@/components/rh/CandidateQuickCreateModal';
import ContractModal from '@/features/candidats/components/ContractModal';
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SCHOOL_LEVEL_LABELS, Localisation } from '@/types/candidate';
import { formatCommune, LOCALISATION_LABELS } from '@/data/reunionCommunes';
import { ALL_DESIRED_SECTORS } from '@/data/candidateTemplates';
import { SECTOR_LABELS } from '@/data/sectors';
import { secteurLabelOfTrainingSite } from '@/constants/secteurs';
import type { Candidate } from '@/types/candidate';
import Button from '@/components/ui/Button';
import MultiSelectField from '@/components/ui/MultiSelectField';
import CandidateSearchBar from '@/components/rh/CandidateSearchBar';
import { useCandidatesPage, useUpdateCandidate, type CandidateServerFilters, type CandidateSearchField } from '@/graphql/hooks';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_BADGE_CLASS } from '@/constants/candidateStatus';
import { usePersistedListView } from '@/hooks/usePersistedListView';
import { graphqlClient } from '@/graphql/client';
import { GET_RH_USERS } from '@/graphql/queries';
import Tabs from '@/components/ui/Tabs'
import Select from '@/components/ui/Select'

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
      return 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] ring-[var(--ds-border)]';
  }
};

const formatTrainingSite = (site?: TrainingSite) => {
  if (!site) return 'Non renseigné';
  return secteurLabelOfTrainingSite(site) ?? site;
};

// --- Tabs ---

type CandidateTab = 'all' | 'active' | 'archived' | 'inactive'

const TAB_STATUS_MAP: Record<Exclude<CandidateTab, 'all'>, CandidateStatus[]> = {
  active: [CandidateStatus.SEEKING],
  archived: [CandidateStatus.CONTRACT, CandidateStatus.IMMERSING],
  inactive: [CandidateStatus.NOT_SEEKING, CandidateStatus.UNAVAILABLE, CandidateStatus.TEST_FAILED, CandidateStatus.BANNED, CandidateStatus.CANCELLED],
}

const TAB_LABELS: Record<CandidateTab, string> = {
  all: 'Tous',
  active: 'Actif',
  archived: 'Archivé',
  inactive: 'Inactif',
}

// --- Main Page Component ---

const PAGE_SIZE = 20;

type DateMode = 'any' | 'before' | 'after' | 'between' | 'none';


interface CandidateFilterState {
  trainingSite: TrainingSite | '';
  status: CandidateStatus | '';
  schoolLevel: SchoolLevel | '';
  permis: 'all' | 'yes' | 'no';
  sex: 'FILLE' | 'GARCON' | '';
  ageMin: number | '';
  ageMax: number | '';
  tpType: TitleProfessionalType[];
  geographicMobility: Localisation[];
  desiredSectors: string[];
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  interviewedBy: string;
}

const EMPTY_CANDIDATE_FILTERS: CandidateFilterState = {
  trainingSite: '',
  status: '',
  schoolLevel: '',
  permis: 'all',
  sex: '',
  ageMin: '',
  ageMax: '',
  tpType: [],
  geographicMobility: [],
  desiredSectors: [],
  dateMode: 'any',
  dateFrom: '',
  dateTo: '',
  interviewedBy: '',
};

function toServerFilters(filters: CandidateFilterState, activeTab: CandidateTab): CandidateServerFilters | undefined {
  // Bornes de création selon le mode choisi (dates yyyy-mm-dd des <input type=date>).
  let createdAfter: string | undefined;
  let createdBefore: string | undefined;
  let createdMissing: boolean | undefined;
  if (filters.dateMode === 'after') createdAfter = filters.dateFrom || undefined;
  else if (filters.dateMode === 'before') createdBefore = filters.dateTo || undefined;
  else if (filters.dateMode === 'between') {
    createdAfter = filters.dateFrom || undefined;
    createdBefore = filters.dateTo || undefined;
  } else if (filters.dateMode === 'none') createdMissing = true;

  const serverFilters: CandidateServerFilters = {
    trainingSite: filters.trainingSite || undefined,
    status: filters.status || undefined,
    statusIn: activeTab !== 'all' ? TAB_STATUS_MAP[activeTab] : undefined,
    schoolLevel: filters.schoolLevel || undefined,
    drivingLicenseB: filters.permis === 'all' ? undefined : filters.permis === 'yes',
    sex: filters.sex || undefined,
    ageMin: filters.ageMin || undefined,
    ageMax: filters.ageMax || undefined,
    tpType: filters.tpType?.length ? filters.tpType : undefined,
    geographicMobility: filters.geographicMobility?.length ? filters.geographicMobility : undefined,
    desiredSectors: filters.desiredSectors?.length ? filters.desiredSectors : undefined,
    createdAfter,
    createdBefore,
    createdMissing,
    interviewedBy: filters.interviewedBy || undefined,
  };
  const hasAny = Object.values(serverFilters).some(v => v !== undefined);
  return hasAny ? serverFilters : undefined;
}

// --- Main Page Component ---

export default function ListeCandidats() {
  const navigate = useNavigate();
  const {
    searchInput,
    setSearchInput,
    debouncedSearch,
    filters,
    setFilters,
    afterCursor,
    cursorHistory,
    loadNextPage,
    loadPrevPage,
  } = usePersistedListView<CandidateFilterState>(
    'disciplina:list-view:candidats',
    EMPTY_CANDIDATE_FILTERS,
    {
      trainingSite: [...Object.values(TrainingSite), ''],
      status: [...Object.values(CandidateStatus), ''],
      schoolLevel: [...Object.values(SchoolLevel), ''],
      permis: ['all', 'yes', 'no'],
      sex: ['FILLE', 'GARCON', ''],
      tpType: Object.values(TitleProfessionalType),
      geographicMobility: Object.values(Localisation),
      dateMode: ['any', 'before', 'after', 'between', 'none'],
    },
    ['ageMin', 'ageMax'],
  );
  const [capturePhotoFor, setCapturePhotoFor] = useState<Candidate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchField, setSearchField] = useState<CandidateSearchField>('NAME');
  const [activeTab, setActiveTab] = useState<CandidateTab>('all');

  const handleTabChange = (tab: CandidateTab) => {
    setActiveTab(tab);
    if (tab !== 'all') {
      setFilters({ ...filters, status: '' });
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pré-remplir le filtre « Entretien fait par » depuis l'URL (lien depuis le tableau de bord RH).
  const [searchParams] = useSearchParams();
  const prefilledRef = useRef(false);
  useEffect(() => {
    const fromUrl = searchParams.get('interviewedBy');
    if (fromUrl && !prefilledRef.current) {
      prefilledRef.current = true;
      setFilters({ ...filters, interviewedBy: fromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liste des RH pour le filtre « Entretien fait par ».
  const [rhUsers, setRhUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  useEffect(() => {
    graphqlClient
      .query(GET_RH_USERS, {})
      .toPromise()
      .then(res => setRhUsers(res.data?.rhUsers ?? []))
      .catch(() => setRhUsers([]));
  }, []);

  const serverFilters = useMemo(() => toServerFilters(filters, activeTab), [filters, activeTab]);

  const { candidates, pageInfo, totalCount, loading, error, refetch } = useCandidatesPage(PAGE_SIZE, afterCursor, debouncedSearch || undefined, serverFilters, searchField);
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);

  // Sync server candidates into local state (enables optimistic edits)
  useMemo(() => { setLocalCandidates(candidates); }, [candidates]);

  const { update: persistCandidate } = useUpdateCandidate();

  // Modal state for IMMERSING
  const [immersionModal, setImmersionModal] = useState<{ id: string; candidate: Candidate } | null>(null);
  const [immersionStart, setImmersionStart] = useState('');
  const [immersionEnd, setImmersionEnd] = useState('');

  // Modal state for UNAVAILABLE
  const [unavailableModal, setUnavailableModal] = useState<{ id: string; candidate: Candidate } | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState('');

  // Modal state for CONTRACT
  const [contractModal, setContractModal] = useState<{ id: string; candidate: Candidate } | null>(null);

  const handleUpdateStatus = async (id: string, newStatus: CandidateStatus) => {
    const candidate = localCandidates.find(c => c._id === id);
    if (!candidate) return;

    if (newStatus === CandidateStatus.IMMERSING) {
      setImmersionStart(candidate.immersion_start_date?.slice(0, 10) ?? '');
      setImmersionEnd(candidate.immersion_end_date?.slice(0, 10) ?? '');
      setImmersionModal({ id, candidate });
      return;
    }

    if (newStatus === CandidateStatus.UNAVAILABLE) {
      setAvailabilityDate(candidate.job_info?.availability_date?.slice(0, 10) ?? '');
      setUnavailableModal({ id, candidate });
      return;
    }

    if (newStatus === CandidateStatus.CONTRACT) {
      setContractModal({ id, candidate });
      return;
    }

    // Optimistic update
    setLocalCandidates(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
    try {
      await persistCandidate(id, { ...candidate, status: newStatus });
    } catch {
      refetch();
    }
  };

  const confirmImmersion = async () => {
    if (!immersionModal) return;
    const { id, candidate } = immersionModal;
    const updated = {
      ...candidate,
      status: CandidateStatus.IMMERSING,
      immersion_start_date: immersionStart || undefined,
      immersion_end_date: immersionEnd || undefined,
    };
    setLocalCandidates(prev => prev.map(c => c._id === id ? updated : c));
    setImmersionModal(null);
    try {
      await persistCandidate(id, updated);
    } catch {
      refetch();
    }
  };

  const confirmUnavailable = async () => {
    if (!unavailableModal) return;
    const { id, candidate } = unavailableModal;
    const updated = {
      ...candidate,
      status: CandidateStatus.UNAVAILABLE,
      job_info: {
        ...candidate.job_info,
        availability_date: availabilityDate || undefined,
      },
    };
    setLocalCandidates(prev => prev.map(c => c._id === id ? updated : c));
    setUnavailableModal(null);
    try {
      await persistCandidate(id, updated);
    } catch {
      refetch();
    }
  };

  const dateFilterActive = filters.dateMode !== 'any' && (
    filters.dateMode === 'none' ||
    (filters.dateMode === 'after' && !!filters.dateFrom) ||
    (filters.dateMode === 'before' && !!filters.dateTo) ||
    (filters.dateMode === 'between' && (!!filters.dateFrom || !!filters.dateTo))
  );
  const activeFiltersCount = [filters.trainingSite, filters.schoolLevel, filters.status, filters.ageMin, filters.ageMax].filter(Boolean).length + (filters.permis !== 'all' ? 1 : 0) + (filters.sex ? 1 : 0) + (dateFilterActive ? 1 : 0) + (filters.tpType?.length ? 1 : 0) + (filters.geographicMobility?.length ? 1 : 0) + (filters.desiredSectors?.length ? 1 : 0) + (filters.interviewedBy ? 1 : 0);
  const hidePagination = !!debouncedSearch;

  const handleResetFilters = () => {
    setFilters(EMPTY_CANDIDATE_FILTERS);
  };

  // Loading state
  if (loading && localCandidates.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--ds-text-subtle)]">
          <IconLoader width={40} height={40} className="animate-spin text-purple" />
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
          <div className="w-12 h-12 rounded-full bg-[var(--ds-danger-bg)] flex items-center justify-center">
            <IconAlert width={24} height={24} className="text-[var(--ds-danger)]" />
          </div>
          <p className="font-semibold text-[var(--ds-text)]">Impossible de charger les candidats</p>
          <p className="text-sm text-[var(--ds-text-subtle)]">{error}</p>
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
          <h1 className="text-3xl font-extrabold text-[var(--ds-text)] tracking-tight">Candidats</h1>
          <p className="text-sm text-[var(--ds-text-subtle)] mt-1">
            {localCandidates.length} candidat{localCandidates.length !== 1 ? 's' : ''} trouvé{localCandidates.length !== 1 ? 's' : ''} sur {totalCount}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CandidateSearchBar
            value={searchInput}
            onChange={setSearchInput}
            field={searchField}
            onFieldChange={setSearchField}
            searching={searchInput.trim() !== debouncedSearch.trim() || (loading && !!debouncedSearch)}
            resultCount={totalCount}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || activeFiltersCount > 0
                ? 'bg-purple-light text-purple ring-1 ring-purple/20'
                : 'bg-[var(--ds-surface)] text-[var(--ds-text-muted)] border border-[var(--ds-border)] hover:border-[var(--ds-border)] shadow-sm'
              }`}
          >
            <IconSliders width={16} height={16} />
            Filtres {activeFiltersCount > 0 && <span className="bg-purple text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1">{activeFiltersCount}</span>}
          </button>
          <Button
            id="btn-nouveau-candidat"
            className="bg-purple hover:bg-purple-dark text-white shadow-sm h-[42px]"
            leftIcon={<IconPlus width={18} height={18} />}
            onClick={() => setShowCreateModal(true)}
          >
            Nouveau
          </Button>
        </div>
      </div>

      <Tabs
        className="mb-6"
        label="Filtrer les candidats par statut"
        tone="purple"
        value={activeTab}
        onChange={handleTabChange}
        options={(Object.keys(TAB_LABELS) as CandidateTab[]).map((tab) => ({
          value: tab,
          label: TAB_LABELS[tab],
        }))}
      />

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] animate-[fadeIn_0.15s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">

            {/* Secteur */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Secteur</label>
              <Select
                size="sm"
                ariaLabel="Secteur"
                value={filters.trainingSite}
                onChange={(value) => setFilters({ ...filters, trainingSite: value as TrainingSite })}
                placeholder="Tous les secteurs"
                options={[
                  { value: '', label: 'Tous les secteurs' },
                  ...Object.values(TrainingSite).map((site) => ({ value: site, label: formatTrainingSite(site) })),
                ]}
              />
            </div>

            {/* Statut */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Statut</label>
              <Select
                size="sm"
                ariaLabel="Statut"
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value as CandidateStatus })}
                placeholder="Tous les statuts"
                options={[
                  { value: '', label: 'Tous les statuts' },
                  ...Object.values(CandidateStatus).map((status) => ({ value: status, label: CANDIDATE_STATUS_LABELS[status] })),
                ]}
              />
            </div>

            {/* Niveau BAC */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Niveau d'études</label>
              <Select
                size="sm"
                ariaLabel="Niveau scolaire"
                value={filters.schoolLevel}
                onChange={(value) => setFilters({ ...filters, schoolLevel: value as SchoolLevel })}
                placeholder="Tous les niveaux"
                options={[
                  { value: '', label: 'Tous les niveaux' },
                  ...Object.values(SchoolLevel).map((level) => ({ value: level, label: SCHOOL_LEVEL_LABELS[level] })),
                ]}
              />
            </div>

            {/* Permis B */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Permis B</label>
              <Select
                size="sm"
                ariaLabel="Permis B"
                value={filters.permis}
                onChange={(value) => setFilters({ ...filters, permis: value as 'all' | 'yes' | 'no' })}
                placeholder="Indifférent"
                options={[
                  { value: 'all', label: 'Indifférent' },
                  { value: 'yes', label: 'Oui' },
                  { value: 'no', label: 'Non' },
                ]}
              />
            </div>

            {/* Sexe */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Sexe</label>
              <Select
                size="sm"
                ariaLabel="Sexe"
                value={filters.sex}
                onChange={(value) => setFilters({ ...filters, sex: value as 'FILLE' | 'GARCON' | '' })}
                placeholder="Tous les sexes"
                options={[
                  { value: '', label: 'Tous les sexes' },
                  { value: 'FILLE', label: 'Femme' },
                  { value: 'GARCON', label: 'Homme' },
                ]}
              />
            </div>

            {/* Type TP */}
            <MultiSelectField
              variant="filter"
              id="filter-tp-type"
              label="Type TP"
              options={Object.values(TitleProfessionalType)}
              value={filters.tpType}
              onChange={vals => setFilters({ ...filters, tpType: vals as TitleProfessionalType[] })}
              placeholder="Tous les types"
            />

            {/* Age Min */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Âge min</label>
              <input
                type="number"
                placeholder="Ex: 18"
                value={filters.ageMin}
                onChange={e => setFilters({ ...filters, ageMin: e.target.value ? Number(e.target.value) : '' })}
                className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              />
            </div>

            {/* Age Max */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Âge max</label>
              <input
                type="number"
                placeholder="Ex: 25"
                value={filters.ageMax}
                onChange={e => setFilters({ ...filters, ageMax: e.target.value ? Number(e.target.value) : '' })}
                className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              />
            </div>

          </div>

          {/* Mobilité géographique + secteurs souhaités (multi-sélection, OR) */}
          <div className="mt-4 pt-4 border-t border-[var(--ds-border)] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MultiSelectField
              variant="filter"
              id="filter-geographic-mobility"
              label="Ville demandée (mobilité)"
              options={Object.values(Localisation)}
              value={filters.geographicMobility ?? []}
              onChange={vals => setFilters({ ...filters, geographicMobility: vals as Localisation[] })}
              getOptionLabel={v => LOCALISATION_LABELS[v as Localisation]}
              placeholder="Toutes les villes"
            />
            <MultiSelectField
              variant="filter"
              id="filter-desired-sectors"
              label="Secteurs d'activité souhaités"
              options={ALL_DESIRED_SECTORS}
              value={filters.desiredSectors ?? []}
              onChange={vals => setFilters({ ...filters, desiredSectors: vals })}
              placeholder="Tous les secteurs"
              getOptionLabel={(s) => SECTOR_LABELS[s] ?? s}
            />
          </div>

          {/* Filtre par date de création */}
          <div className="mt-4 pt-4 border-t border-[var(--ds-border)] flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            <div className="flex flex-col gap-1.5 sm:w-56">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Date de création</label>
              <select
                value={filters.dateMode}
                onChange={e => setFilters({ ...filters, dateMode: e.target.value as DateMode })}
                className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              >
                <option value="any">Toutes les dates</option>
                <option value="after">Après le…</option>
                <option value="before">Avant le…</option>
                <option value="between">Entre deux dates</option>
                <option value="none">Sans date</option>
              </select>
            </div>

            {(filters.dateMode === 'after' || filters.dateMode === 'between') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">
                  {filters.dateMode === 'between' ? 'Du' : 'Après le'}
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
                />
              </div>
            )}

            {(filters.dateMode === 'before' || filters.dateMode === 'between') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">
                  {filters.dateMode === 'between' ? 'Au' : 'Avant le'}
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
                />
              </div>
            )}
          </div>

          {/* Filtre par entretien fait par */}
          <div className="mt-4 pt-4 border-t border-[var(--ds-border)]">
            <div className="flex flex-col gap-1.5 sm:w-72">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]">Entretien fait par</label>
              <select
                value={filters.interviewedBy}
                onChange={e => setFilters({ ...filters, interviewedBy: e.target.value })}
                className="w-full bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-3 py-2 text-sm focus:border-purple focus:ring-purple/20 outline-none"
              >
                <option value="">Tous les RH</option>
                {rhUsers.map(u => {
                  const name = `${u.firstName} ${u.lastName}`.trim();
                  return <option key={u.id} value={name}>{name}</option>;
                })}
              </select>
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ds-danger)] hover:text-pink-dark transition-colors"
              >
                <IconTrash width={14} height={14} />
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
            className="group relative bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple/30 transition-all cursor-pointer flex flex-col h-full overflow-hidden"
          >
            {candidate.status === CandidateStatus.TEST_FAILED && candidate.test_failure_pending && (
              <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl text-[9px] font-bold uppercase tracking-wider bg-orange-500 text-white z-10">
                En attente
              </div>
            )}
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
            {candidate.status === CandidateStatus.CONTRACT && candidate.contract_company_name && (
              <div
                className="absolute top-8 right-0 px-4 py-0.5 text-[10px] font-medium text-[var(--ds-text-subtle)] text-right max-w-[60%] truncate z-10"
                title={candidate.contract_company_name}
              >
                {candidate.contract_company_name}
              </div>
            )}

            {/* Card Header: Avatar */}
            <div className="mb-4 mt-2">
              <div className="relative w-14 h-14">
                <CandidateAvatar
                  candidateId={candidate._id}
                  fullName={candidate.identity.full_name}
                  hasPhoto={Boolean(
                    candidate.identity.avatar_updated_at ||
                      candidate.identity.drive_avatar_file_id ||
                      candidate.photo_link,
                  )}
                  version={candidate.identity.avatar_updated_at ?? candidate.identity.drive_avatar_file_id}
                  className="w-14 h-14 rounded-full ring-2 ring-gray-50 group-hover:ring-purple-light transition-all"
                  iconSize={24}
                />
                <button
                  title="Prendre une photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCapturePhotoFor(candidate);
                  }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple text-white flex items-center justify-center ring-2 ring-white hover:bg-purple/90"
                >
                  <IconCamera width={12} height={12} />
                </button>
              </div>
            </div>

            {/* Card Body: Info */}
            <div className="mb-4 flex-1">
              <h3 className="text-lg font-bold text-[var(--ds-text)] mb-1 group-hover:text-purple transition-colors">
                {candidate.identity.full_name}
              </h3>
              <div className="mb-4 mt-1 flex gap-2 flex-wrap">
                {(candidate.tp_types ?? []).map(tp => (
                  <span key={tp} className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ring-1 inset-ring ${getTpTypeColors(tp)}`}>
                    {tp}
                  </span>
                ))}
                {candidate.identity.psh_referral_request && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-purple-light text-purple ring-1 ring-purple-light/30">
                    RQTH
                  </span>
                )}
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                  <IconMail width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
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
                            ? 'text-[var(--ds-success)] bg-success/10 opacity-100'
                            : 'md:opacity-0 focus:opacity-100 group-hover:opacity-100 text-[var(--ds-text-subtle)] hover:text-purple hover:bg-purple-light'
                        }`}
                        title="Copier l'email"
                      >
                        {copiedId === candidate._id ? (
                          <IconCheck width={14} height={14} className="animate-[ping__.3s_ease-in-out_1]" />
                        ) : (
                          <IconCopy width={14} height={14} />
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="truncate flex-1">-</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                  <IconPhone width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
                  <span className="truncate">{candidate.identity.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                  <IconTraining width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
                  <span className="truncate">{candidate.education?.school_level ? SCHOOL_LEVEL_LABELS[candidate.education.school_level] : (candidate.background?.last_diploma || '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-[var(--ds-text-muted)]">
                  <div className="flex items-center gap-2 shrink-0">
                    <IconCalendar width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
                    <span>{candidate.identity.age ? `${candidate.identity.age} ans` : '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <IconMapPin width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
                    <span className="truncate">{formatCommune(candidate.identity.city)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                  <IconCar width={16} height={16} className="text-[var(--ds-text-subtle)] shrink-0" />
                  <span>Permis B: {candidate.identity.driving_license_b ? 'Oui' : 'Non'}</span>
                </div>

                {candidate.profile?.qualities && candidate.profile.qualities.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-[var(--ds-border)] flex flex-wrap gap-1.5">
                    {candidate.profile.qualities.slice(0, 3).map((q, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-[11px] font-medium rounded-md whitespace-nowrap truncate max-w-full">
                        {q}
                      </span>
                    ))}
                    {candidate.profile.qualities.length > 3 && (
                      <span className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] text-[11px] font-medium rounded-md whitespace-nowrap">
                        +{candidate.profile.qualities.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {(candidate.created_at || candidate.owner?.name) && (
                  <div className="pt-3 mt-3 border-t border-[var(--ds-border)] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ds-text-subtle)]">
                    {candidate.created_at && (
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar width={12} height={12} className="shrink-0" />
                        Créé le {new Date(candidate.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {candidate.owner?.name && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <IconUser width={12} height={12} className="shrink-0" />
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
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-[var(--ds-text-subtle)] bg-[var(--ds-surface)] rounded-2xl border border-dashed border-[var(--ds-border)]">
            <IconUser width={48} height={48} className="text-[var(--ds-text-subtle)] mb-4" />
            <p className="text-lg font-medium text-[var(--ds-text)]">Aucun candidat trouvé</p>
            <p className="text-sm">Essayez de modifier votre recherche ou vos filtres.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!hidePagination && (
        <div className="mt-8 flex items-center justify-between rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] px-5 py-4 shadow-sm">
          <button
            type="button"
            onClick={loadPrevPage}
            disabled={cursorHistory.length === 0 || loading}
            className="px-4 py-2 border border-[var(--ds-border)] text-[var(--ds-text-muted)] font-semibold text-[13px] rounded-[8px] hover:border-[var(--ds-border-strong)] bg-[var(--ds-surface)] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Page précédente
          </button>
          <button
            type="button"
            onClick={() => loadNextPage(pageInfo)}
            disabled={!pageInfo?.hasNextPage || loading}
            className="px-4 py-2 border border-[var(--ds-border)] text-[var(--ds-text-muted)] font-semibold text-[13px] rounded-[8px] hover:border-[var(--ds-border-strong)] bg-[var(--ds-surface)] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Page suivante →
          </button>
        </div>
      )}

      {/* Create Modal — bare minimum (name/email/phone + RGPD) then navigate to fiche */}
      {showCreateModal && (
        <CandidateQuickCreateModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => refetch()}
          onCreated={(id) => {
            setShowCreateModal(false)
            refetch()
            navigate(`/rh/candidats/${id}`)
          }}
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

      {/* Immersion date modal */}
      {immersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImmersionModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Passage en immersion</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Renseigne les dates de début et de fin de l'immersion.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-[var(--ds-text-muted)]" htmlFor="imm-start-list">Date de début</label>
                <input id="imm-start-list" type="date" className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-3 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-blue mt-1" value={immersionStart} onChange={e => setImmersionStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--ds-text-muted)]" htmlFor="imm-end-list">Date de fin</label>
                <input id="imm-end-list" type="date" className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-3 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-blue mt-1" value={immersionEnd} min={immersionStart || undefined} onChange={e => setImmersionEnd(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setImmersionModal(null)} className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:border-[var(--ds-border)]">Annuler</button>
              <button onClick={confirmImmersion} disabled={!immersionStart || !immersionEnd} className="rounded-xl bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Unavailable date modal */}
      {unavailableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setUnavailableModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Indisponible jusqu'au</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Le candidat repassera automatiquement en « Recherche » à cette date.</p>
            <div className="mt-4">
              <label className="text-sm font-medium text-[var(--ds-text-muted)]" htmlFor="avail-date">Date de disponibilité</label>
              <input id="avail-date" type="date" className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-3 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-blue mt-1" value={availabilityDate} onChange={e => setAvailabilityDate(e.target.value)} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setUnavailableModal(null)} className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:border-[var(--ds-border)]">Annuler</button>
              <button onClick={confirmUnavailable} disabled={!availabilityDate} className="rounded-xl bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Contract modal */}
      {contractModal && (
        <ContractModal
          candidate={contractModal.candidate}
          onSuccess={(updated) => {
            setLocalCandidates(prev => prev.map(c => c._id === updated._id ? updated : c));
            setContractModal(null);
          }}
          onClose={() => setContractModal(null)}
        />
      )}

    </div>
  );
}
