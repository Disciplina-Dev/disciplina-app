/**
 * Modèle par défaut du mail de redirection après un test non réussi
 * (scope rh, kind `test_failure_redirection`). Semé une seule fois ;
 * ensuite éditable dans « Modèles mail » (scope rh).
 *
 * Variables remplacées à l'envoi :
 *   {{prenom}}        → prénom du candidat
 *   {{orientations}}  → liste des structures vers lesquelles la candidature
 *                       a été redirigée (ex. « RSMA, E2C »)
 *   {{hr_signature}}  → signature mail du RH (image)
 */
export const TEST_FAILURE_REDIRECTION_SUBJECT = '[Disciplina] Votre candidature a été redirigée';

export const TEST_FAILURE_REDIRECTION_BODY = `<p>Bonjour {{prenom}},</p>
<p>Suite aux résultats de vos tests, votre candidature à Disciplina n'a pas été retenue pour cette fois.</p>
<p>Bonne nouvelle cependant : votre candidature a été redirigée vers {{orientations}}, qui pourront vous accompagner vers d'autres opportunités.</p>
<p>Si vous avez la moindre question, votre conseiller reste à votre disposition.</p>
<p>Cordialement,</p>
<p><strong>L'équipe Disciplina</strong></p>
{{hr_signature}}`;
