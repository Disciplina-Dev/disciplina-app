import { IconCalendar, IconCheckCircle, IconClipboardCheck, IconClock, IconErrorCircle, IconFile, IconLoader } from '@/components/ui/icons'
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
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--color-purple-light)' }}
        >
          <IconClipboardCheck width={15} height={15} style={{ color: purple }} />
        </div>
        <h2 className="text-sm font-semibold text-[var(--ds-text-muted)]">Résultat du test</h2>
      </div>

      {!hasResult && (
        <div className="flex items-center gap-2 text-sm text-[var(--ds-text-subtle)] py-2">
          {loading ? (
            <IconLoader width={14} height={14} className="animate-spin" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-border-strong)]" aria-hidden="true" />
          )}
          <span>{loading ? 'Chargement…' : 'En attente de résultat'}</span>
        </div>
      )}

      {hasResult && (
        <div className="flex flex-col gap-3">
          {result?.test_name && (
            <p className="text-sm font-medium text-[var(--ds-text)]">{result.test_name}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--ds-text-subtle)] uppercase tracking-wide">Score</span>
              <span className="text-lg font-semibold" style={{ color: purple }}>
                {(result!.percentage ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ds-surface-sunken)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, result!.percentage ?? 0))}%`,
                  backgroundColor: purple,
                }}
              />
            </div>
            {typeof result?.points_scored === 'number' && typeof result?.points_available === 'number' && (
              <p className="text-xs text-[var(--ds-text-subtle)]">
                {result.points_scored} / {result.points_available} points
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {typeof result?.passed === 'boolean' && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                  result.passed ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]'
                }`}
              >
                {result.passed ? <IconCheckCircle width={13} height={13} /> : <IconErrorCircle width={13} height={13} />}
                {result.passed ? 'Réussi' : 'Échoué'}
              </span>
            )}
            {result?.duration && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]">
                <IconClock width={13} height={13} />
                {result.duration}
              </span>
            )}
            {formatDate(result?.completed_at) && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]">
                <IconCalendar width={13} height={13} />
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
              <IconFile width={13} height={13} />
              Voir le PDF des résultats
            </a>
          )}
        </div>
      )}

      {pastTests.length > 0 && (
        <div className="mt-1 flex flex-col gap-2 border-t border-[var(--ds-border)] pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ds-text-subtle)]">
            Tests précédents ({pastTests.length})
          </p>
          {pastTests.map((t, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--ds-surface-sunken)] px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-[var(--ds-text-muted)]">
                  {t.test_name || 'Test'}
                </span>
                {formatDate(t.completed_at) && (
                  <span className="text-[var(--ds-text-subtle)]">{formatDate(t.completed_at)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typeof t.passed === 'boolean' && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                      t.passed ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]'
                    }`}
                  >
                    {t.passed ? <IconCheckCircle width={11} height={11} /> : <IconErrorCircle width={11} height={11} />}
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
                    <IconFile width={12} height={12} />
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
