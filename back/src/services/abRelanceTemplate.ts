/**
 * Modèle par défaut du mail de relance « Analyse du Besoin à signer »
 * (scope commercial, kind `ab_relance`). Semé une seule fois ; ensuite éditable
 * dans « Modèles mail ». Utilisé par le job automatique de relance d'une AB
 * toujours non signée 2 semaines après son envoi (cf. AbSignatureRelanceService).
 *
 * Variables remplacées à l'envoi :
 *   {{entreprise}}      → nom de l'entreprise
 *   {{lien_signature}}  → bouton/lien de signature DocuSeal (obligatoire)
 *   {{signature}}       → signature mail du commercial (image)
 */
export const AB_RELANCE_SUBJECT = 'DISCIPLINA – Rappel : votre Analyse du Besoin à signer';

export const AB_RELANCE_BODY = `<p>Bonjour,</p>
<p>Je reviens vers vous au sujet de l'Analyse du Besoin de <strong>{{entreprise}}</strong> : les documents de signature sont toujours en attente.</p>
<p><strong>— Documents à signer électroniquement —</strong><br/>
Pour que nous puissions démarrer la recherche de profils, merci de signer en ligne :</p>
<ul>
<li>L'Analyse du Besoin Entreprise (ABE)</li>
<li>Le Mandat de publication d'offres d'emploi</li>
</ul>
<p>{{lien_signature}}</p>
<p>La signature est simple, rapide et n'engendre aucun frais. Si vous avez la moindre question sur les documents, je reste à votre disposition.</p>
<p>Bien cordialement,</p>
{{signature}}`;
