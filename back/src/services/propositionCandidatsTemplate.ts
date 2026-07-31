/**
 * Modèle par défaut du mail d'invitation à la sélection de candidats
 * (scope rh, kind `proposition_candidat`). Semé une seule fois ; ensuite éditable
 * dans « Modèles mail » (scope rh).
 *
 * Variables remplacées à l'envoi (cf. MatchMailService.sendInvitation) :
 *   {{hr_name}}          → prénom + nom du RH qui envoie
 *   {{link}}             → lien de la session de matching
 *   {{id}}               → identifiant de connexion
 *   {{code}}             → code de connexion
 *   {{expiration time}}  → durée de validité du lien
 *   {{hr_signature}}     → signature mail du RH (image)
 */
export const PROPOSITION_CANDIDAT_SUBJECT = 'Disciplina - Proposition de candidats';

export const PROPOSITION_CANDIDAT_BODY = `<p>Bonjour,</p>
<p>Je me présente, {{hr_name}}, chargé de recrutement au sein du centre de formation Disciplina.</p>
<p>
  Je vous contacte suite à votre demande de candidats pour un apprentissage au sein de votre entreprise.
  Voici le lien et les identifiants pour démarrer votre session :
</p>
<p>{{link}}</p>
<p>
  <strong>Identifiant</strong> : {{id}}<br>
  <strong>Code</strong> : {{code}}
</p>
<p><em>Ce lien expire dans {{expiration time}}.</em></p>
<p>Je reste disponible pour tout complément d'information.</p>
<p>Cordialement,</p>
{{hr_signature}}`;
