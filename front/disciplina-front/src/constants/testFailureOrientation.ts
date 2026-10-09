// Orientation proposée après un « Test non réussi » (prompt de commentaire).
// La dernière option signifie que le candidat refuse le partage : elle est
// exclue du corps du mail de redirection.

export const TEST_FAILURE_NO_SHARE_VALUE = 'no-share';

export interface TestFailureOrientationOption {
  value: string;
  label: string;
}

export const TEST_FAILURE_ORIENTATION_OPTIONS: TestFailureOrientationOption[] = [
  { value: 'rsma', label: 'RSMA' },
  { value: 'e2c', label: 'E2C' },
  { value: 'mission-locale', label: 'Mission Locale' },
  { value: 'alie', label: 'Association ALIE' },
  { value: TEST_FAILURE_NO_SHARE_VALUE, label: 'Le candidat ne souhaite pas que sa candidature soit partagée' },
];

export function testFailureOrientationLabels(values: string[]): string[] {
  return values
    .map((v) => TEST_FAILURE_ORIENTATION_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);
}

/** Libellés redirigés (hors refus de partage) pour le commentaire et le mail. */
export function testFailureRedirectionLabels(values: string[]): string[] {
  return testFailureOrientationLabels(values.filter((v) => v !== TEST_FAILURE_NO_SHARE_VALUE));
}

export function buildTestFailureComment(baseComment: string, orientations: string[]): string {
  const comment = baseComment.trim();
  if (!orientations.length) return comment;
  const labels = testFailureOrientationLabels(orientations);
  const suffix =
    orientations.includes(TEST_FAILURE_NO_SHARE_VALUE) && labels.length === 1
      ? `Orientation : ${labels[0]}.`
      : `Orientation vers : ${labels.join(', ')}.`;
  return comment ? `${comment}\n${suffix}` : suffix;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const TEST_FAILURE_REDIRECTION_SUBJECT = 'Votre candidature a été redirigée';

export function buildTestFailureRedirectionBody(firstName: string, orientations: string[]): string {
  const labels = testFailureRedirectionLabels(orientations);
  const greeting = firstName ? `<p>Bonjour ${escapeHtml(firstName)},</p>` : '<p>Bonjour,</p>';
  const redirection =
    labels.length > 0
      ? `<p>Suite aux résultats de vos tests, votre candidature à Disciplina n'a pas été retenue pour cette fois.</p><p>Votre candidature a été redirigée vers ${escapeHtml(labels.join(', '))}, qui pourront vous accompagner vers d'autres opportunités.</p>`
      : `<p>Suite aux résultats de vos tests, votre candidature à Disciplina n'a pas été retenue pour cette fois. Conformément à votre souhait, elle ne sera pas partagée.</p>`;
  return `${greeting}${redirection}<p>Si vous avez la moindre question, votre conseiller reste à votre disposition.</p><p>Cordialement,</p><p><strong>L'équipe Disciplina</strong></p>`;
}
