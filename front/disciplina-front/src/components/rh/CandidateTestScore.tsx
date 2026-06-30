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
  const { result, history, loading } = useClassMarkerResult(candidateId);

  const hasResult = result && typeof result.percentage === 'number';
  const purple = 'var(--color-purple)';
  // Tests antérieurs : tout l'historique sauf le plus récent (déjà affiché en haut).
  const pastTests = history.slice(1);

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

      {pastTests.length > 0 && (
        <div className="mt-1 flex flex-col gap-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Tests précédents ({pastTests.length})
          </p>
          {pastTests.map((t, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-gray-700">
                  {t.test_name || 'Test'}
                </span>
                {formatDate(t.completed_at) && (
                  <span className="text-gray-400">{formatDate(t.completed_at)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typeof t.passed === 'boolean' && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                      t.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {t.passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {(t.percentage ?? 0).toFixed(1)}%
                  </span>
                )}
                {t.pdf_link && (
                  <a
                    href={t.pdf_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:opacity-80"
                    style={{ color: purple }}
                    title="Voir le PDF"
                  >
                    <FileText size={12} />
                    PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
