export function buildCandidateTestUrl(
  linkUrlId: string,
  firstName: string,
  lastName: string,
  candidateId: string
): string {
  const params = new URLSearchParams({
    quiz: linkUrlId,
    cm_fn: firstName,
    cm_ln: lastName,
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
