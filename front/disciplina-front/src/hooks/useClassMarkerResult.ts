import { useEffect, useState } from 'react';
import type { ClassMarkerResult } from '@/types/classmarker';
import { fetchClassMarkerResult, classMarkerStreamUrl } from '@/api/classmarker';

export function useClassMarkerResult(candidateId: string | undefined) {
  const [result, setResult] = useState<ClassMarkerResult | null>(null);
  const [history, setHistory] = useState<ClassMarkerResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

    const url = classMarkerStreamUrl(candidateId);
    console.log('[ClassMarker] SSE connect →', url);
    const es = new EventSource(url);

    es.onopen = () => console.log('[ClassMarker] SSE connecté ✓');
    es.onmessage = (e) => {
      console.log('[ClassMarker] SSE reçu:', e.data);
      try {
        const data = JSON.parse(e.data) as ClassMarkerResult;
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

  return { result, history, loading };
}
