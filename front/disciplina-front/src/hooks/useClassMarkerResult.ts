import { useEffect, useState } from 'react';
import type { ClassMarkerResult } from '@/types/classmarker';
import type { QuestionnaireProgress } from '@/types/questionnaire';
import { fetchClassMarkerResult, classMarkerStreamUrl } from '@/api/classmarker';

export function useClassMarkerResult(candidateId: string | undefined) {
  const [result, setResult] = useState<ClassMarkerResult | null>(null);
  const [history, setHistory] = useState<ClassMarkerResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Suivi en direct des questionnaires internes, indexé par tentative.
  const [progress, setProgress] = useState<Record<string, QuestionnaireProgress>>({});

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetchClassMarkerResult(candidateId)
      .then(bundle => {
        console.log('[ClassMarker] résultat initial depuis DB:', bundle);
        if (!cancelled && bundle) {
          setResult(bundle.result);
          // Plus récent en premier pour l'affichage.
          setHistory([...bundle.history].reverse());
        }
      })
      .catch((err) => { console.warn('[ClassMarker] fetch initial échoué:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const es = new EventSource(classMarkerStreamUrl(candidateId), { withCredentials: true });

    es.onopen = () => console.log('[ClassMarker] SSE connecté ✓');
    es.onmessage = (e) => {
      console.log('[ClassMarker] SSE reçu:', e.data);
      try {
        const parsed = JSON.parse(e.data) as ClassMarkerResult & { questionnaire_progress?: QuestionnaireProgress };
        // Progression d'un questionnaire interne : ce n'est pas un résultat, ne pas le fusionner.
        if (parsed.questionnaire_progress) {
          const p = parsed.questionnaire_progress;
          setProgress(prev => ({ ...prev, [p.attempt_id]: p }));
          return;
        }
        const data = parsed;
        setResult(prev => ({ ...(prev ?? {}), ...data }));
        // Un payload avec percentage = nouveau test → on l'ajoute en tête.
        // Sinon (ex: pdf_link seul) → on patche l'entrée la plus récente.
        if (typeof data.percentage === 'number') {
          setHistory(prev => [data, ...prev]);
        } else {
          setHistory(prev =>
            prev.length ? [{ ...prev[0], ...data }, ...prev.slice(1)] : prev,
          );
        }
      } catch { /* skip malformed */ }
    };
    es.onerror = (e) => { console.warn('[ClassMarker] SSE erreur (reconnexion auto):', e); };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [candidateId]);

  return { result, history, loading, progress };
}
