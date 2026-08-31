/**
 * Modèle par défaut du mail d'invitation à la sélection de candidats
 * (scope rh, kind `proposition_candidat`). Semé une seule fois ; ensuite éditable
 * dans « Modèles mail » (scope rh).
 *
 * Variables remplacées à l'envoi (cf. MatchMailService.sendInvitation) :
 *   {{hr_name}}          → prénom + nom du RH qui envoie
 *   {{link}}             → bouton d'accès à la session de matching
 *   {{hr_signature}}     → signature mail du RH (image)
 *
 * Le code de connexion n'est PAS dans ce mail : il est généré et envoyé
 * automatiquement au chargement de la page (workflow external access).
 */
export const PROPOSITION_CANDIDAT_SUBJECT = 'Disciplina - Proposition de candidats';

export const PROPOSITION_CANDIDAT_BODY = `<p>Bonjour,</p>
<p>Je me présente, {{hr_name}}, chargé de recrutement au sein du centre de formation Disciplina.</p>
<p>
  Je vous contacte suite à votre demande de candidats pour un apprentissage au sein de votre entreprise.
  Voici le lien d'accès à votre session de sélection :
</p>
<p style="text-align:center;margin:24px 0">{{link}}</p>
<p>Je reste disponible pour tout complément d'information.</p>
<p>Cordialement,</p>
{{hr_signature}}`;