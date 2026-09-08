/**
 * Modèle par défaut du mail d'invitation à la réservation d'un créneau
 * d'entretien (scope rh, kind `interview_invitation`). Semé une seule fois ;
 * ensuite éditable dans « Modèles mail » (scope rh).
 *
 * Variables remplacées à l'envoi (cf. InterviewMailService.sendInvitation) :
 *   {{company_name}}   → nom de l'entreprise qui recrute
 *   {{link}}           → bouton d'accès à la réservation
 *   {{hr_signature}}   → signature mail du RH (image)
 *
 * Le code de connexion n'est PAS dans ce mail : il est généré et envoyé
 * automatiquement au chargement de la page (workflow external access).
 */
export const INTERVIEW_INVITATION_SUBJECT = '[Disciplina] Choisissez votre créneau d\'entretien';

export const INTERVIEW_INVITATION_BODY = `<p>Bonjour,</p>
<p>{{company_name}} souhaite vous rencontrer. Cliquez sur le bouton ci-dessous pour choisir votre créneau d'entretien.</p>
<p style="text-align:center;margin:24px 0">{{link}}</p>
<p><em>Ce lien expire dans 7 jours.</em></p>
<p>Cordialement,</p>
{{hr_signature}}`;