import { useEffect, useState } from 'react';
import type { ClassMarkerResult } from '@/types/classmarker';
import { fetchClassMarkerResult, classMarkerStreamUrl } from '@/api/classmarker';

export function useClassMarkerResult(candidateId: string | undefined) {
  const [result, setResult] = useState<ClassMarkerResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetchClassMarkerResult(candidateId)
      .then(r => {
        console.log('[ClassMarker] résultat initial depuis DB:', r);
        if (!cancelled) setResult(r);
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
      } catch { /* skip malformed */ }
    };
    es.onerror = (e) => { console.warn('[ClassMarker] SSE erreur (reconnexion auto):', e); };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [candidateId]);

  return { result, loading };
}
