import { ClipboardCheck, Clock, Calendar, Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useClassMarkerResult } from '@/hooks/useClassMarkerResult';

interface CandidateTestScoreProps {
  candidateId: string;
}

function formatDate(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function CandidateTestScore({ candidateId }: CandidateTestScoreProps) {
  const { result, loading } = useClassMarkerResult(candidateId);

  const hasResult = result && typeof result.percentage === 'number';
  const purple = 'var(--color-purple)';

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--color-purple-light)' }}
        >
          <ClipboardCheck size={15} style={{ color: purple }} />
        </div>
        <h2 className="text-sm font-semibold text-gray-700">Résultat du test</h2>
      </div>

      {!hasResult && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" aria-hidden="true" />
          )}
          <span>{loading ? 'Chargement…' : 'En attente de résultat'}</span>
        </div>
      )}

      {hasResult && (
        <div className="flex flex-col gap-3">
          {result?.test_name && (
            <p className="text-sm font-medium text-gray-800">{result.test_name}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Score</span>
              <span className="text-lg font-semibold" style={{ color: purple }}>
                {(result!.percentage ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, result!.percentage ?? 0))}%`,
                  backgroundColor: purple,
                }}
              />
            </div>
            {typeof result?.points_scored === 'number' && typeof result?.points_available === 'number' && (
              <p className="text-xs text-gray-400">
                {result.points_scored} / {result.points_available} points
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {typeof result?.passed === 'boolean' && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                  result.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {result.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {result.passed ? 'Réussi' : 'Échoué'}
              </span>
            )}
            {result?.duration && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Clock size={13} />
                {result.duration}
              </span>
            )}
            {formatDate(result?.completed_at) && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={13} />
                {formatDate(result?.completed_at)}
              </span>
            )}
          </div>

          {result?.pdf_link && (
            <a
              href={result.pdf_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--color-purple-light)', color: purple }}
            >
              <FileText size={13} />
              Voir le PDF des résultats
            </a>
          )}
        </div>
      )}
    </div>
  );
}
