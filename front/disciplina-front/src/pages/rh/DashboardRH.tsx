import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  FileSignature,
  Search,
  Briefcase,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useCandidateStats, type StatBucket, type TpStatusBucket } from '@/graphql/hooks';
import { CandidateStatus, TitleProfessionalType, TrainingSite } from '@/types/candidate';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_CHART_COLOR, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus';

// --- Charte graphique (cf. index.css) ---
const COLORS = {
  blue: '#1130A7',
  purple: '#60207E',
  pink: '#B10F55',
  success: '#1A7A4A',
  warning: '#A65C00',
  danger: '#C0152A',
  gray500: '#6B6B6B',
  grid: '#E8E8E4',
};

const TP_LABELS: Record<string, string> = {
  [TitleProfessionalType.AD]: 'AD · Administrateur',
  [TitleProfessionalType.CC]: 'CC · Chef de projet',
  [TitleProfessionalType.NTC]: 'NTC · Négo. Technico-Com.',
  [TitleProfessionalType.REM]: 'REM · Resp. Étab. Médico-Social',
  [TitleProfessionalType.SA]: 'SA · Secrétaire',
};

// Palette dédiée aux TP (cf. ListeCandidats).
const TP_COLORS: Record<string, string> = {
  [TitleProfessionalType.AD]: '#0F766E',
  [TitleProfessionalType.CC]: '#4338CA',
  [TitleProfessionalType.NTC]: '#A21CAF',
  [TitleProfessionalType.REM]: '#4D7C0F',
  [TitleProfessionalType.SA]: '#334155',
};

const TP_ORDER = Object.values(TitleProfessionalType) as string[];

const SITE_LABELS: Record<string, string> = {
  [TrainingSite.NORD_SAINTE_MARIE]: 'Nord · Sainte-Marie',
  [TrainingSite.OUEST_SAINT_PAUL]: 'Ouest · Saint-Paul',
  [TrainingSite.SUD_SAINT_PIERRE]: 'Sud · Saint-Pierre',
};

/** Index un tableau de buckets `{ key, count }` en map clé → count. */
function indexBuckets(buckets: StatBucket[]): Record<string, number> {
  return buckets.reduce<Record<string, number>>((acc, b) => {
    acc[b.key] = b.count;
    return acc;
  }, {});
}

// --- Sous-composants présentationnels ---

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}14`, color: accent }}
      >
        <Icon size={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-extrabold text-black">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardRH() {
  const { stats, loading, error, refetch } = useCandidateStats();

  const statusData = useMemo(() => {
    if (!stats) return [];
    const idx = indexBuckets(stats.byStatus);
    return CANDIDATE_STATUS_ORDER.filter((s) => idx[s]).map((s) => ({
      key: s,
      name: CANDIDATE_STATUS_LABELS[s] ?? s,
      value: idx[s],
      color: CANDIDATE_STATUS_CHART_COLOR[s] ?? COLORS.gray500,
    }));
  }, [stats]);

  const tpData = useMemo(() => {
    if (!stats) return [];
    const idx = indexBuckets(stats.byTpType);
    return TP_ORDER.map((tp) => ({
      key: tp,
      name: tp,
      value: idx[tp] ?? 0,
      color: TP_COLORS[tp] ?? COLORS.blue,
    }));
  }, [stats]);

  const siteData = useMemo(() => {
    if (!stats) return [];
    return stats.byTrainingSite.map((b) => ({
      name: SITE_LABELS[b.key] ?? b.key,
      value: b.count,
    }));
  }, [stats]);

  // Histogramme empilé : une ligne par TP, une série par statut.
  const tpStatusData = useMemo(() => {
    if (!stats) return [];
    const matrix: Record<string, Record<string, number>> = {};
    stats.byTpAndStatus.forEach((r: TpStatusBucket) => {
      (matrix[r.tpType] ??= {})[r.status] = r.count;
    });
    return TP_ORDER.map((tp) => ({
      name: tp,
      ...CANDIDATE_STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
        acc[s] = matrix[tp]?.[s] ?? 0;
        return acc;
      }, {}),
    }));
  }, [stats]);

  // Statuts réellement présents (pour ne pas afficher de séries vides).
  const activeStatuses = useMemo(
    () => CANDIDATE_STATUS_ORDER.filter((s) => statusData.some((d) => d.key === s)),
    [statusData],
  );

  const contracted = stats?.byStatus.find((b) => b.key === CandidateStatus.CONTRACT)?.count ?? 0;
  const seeking = stats?.byStatus.find((b) => b.key === CandidateStatus.SEEKING)?.count ?? 0;
  const immersing = stats?.byStatus.find((b) => b.key === CandidateStatus.IMMERSING)?.count ?? 0;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-blue" size={36} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-danger">
        <AlertCircle size={36} />
        <p className="font-medium">Erreur de chargement des statistiques</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
        >
          <RefreshCw size={16} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1>Tableau de bord RH</h1>
          <p className="mt-1 text-gray-500">Vue d'ensemble des candidats</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Total candidats" value={stats?.total ?? 0} accent={COLORS.blue} />
        <KpiCard icon={FileSignature} label="En contrat" value={contracted} accent={COLORS.success} />
        <KpiCard icon={Search} label="En recherche" value={seeking} accent={COLORS.blue} />
        <KpiCard icon={Briefcase} label="En immersion" value={immersing} accent={COLORS.pink} />
      </div>

      {/* Répartition par statut + par TP */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Répartition par statut">
          {statusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Candidats par type de titre (TP)">
          {tpData.every((d) => d.value === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tpData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`${v}`, 'Candidats']}
                  labelFormatter={(l) => TP_LABELS[l as string] ?? (l as string)}
                />
                <Bar dataKey="value" name="Candidats" radius={[6, 6, 0, 0]}>
                  {tpData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Croisement TP x statut */}
      <ChartCard title="Statuts par type de titre (TP)">
        {tpStatusData.every((row) => activeStatuses.every((s) => (row as unknown as Record<string, number>)[s] === 0)) ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={tpStatusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {activeStatuses.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="tp"
                  name={CANDIDATE_STATUS_LABELS[s] ?? s}
                  fill={CANDIDATE_STATUS_CHART_COLOR[s] ?? COLORS.gray500}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Par site de formation */}
      {siteData.length > 0 && (
        <ChartCard title="Candidats par site de formation">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={siteData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}`, 'Candidats']} />
              <Bar dataKey="value" name="Candidats" fill={COLORS.purple} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-gray-300">
      Aucune donnée disponible
    </div>
  );
}
