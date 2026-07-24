// Minimisation RGPD : seul cm_user_id part chez ClassMarker. C'est la seule valeur
// que le webhook relit ; les noms n'alimentaient que les rapports de ClassMarker et
// n'ont jamais été relus par l'application.
export function buildCandidateTestUrl(linkUrlId: string, candidateId: string): string {
  const params = new URLSearchParams({
    quiz: linkUrlId,
    cm_user_id: candidateId,
  });
  return `https://www.classmarker.com/online-test/start?${params.toString()}`;
}

export function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return { first: '', last: '' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
