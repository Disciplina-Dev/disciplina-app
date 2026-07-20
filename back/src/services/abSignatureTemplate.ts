/**
 * Modèle par défaut du mail « Analyse du Besoin à signer » (scope commercial,
 * kind `ab_signature`). Semé une seule fois ; ensuite éditable dans « Modèles mail ».
 *
 * Variables remplacées à l'envoi (cf. NeedsAnalysisService.sendForSignature) :
 *   {{entreprise}}      → nom de l'entreprise
 *   {{lien_signature}}  → bouton/lien de signature DocuSeal (obligatoire)
 *   {{signature}}       → signature mail du commercial (image)
 */
export const AB_SIGNATURE_SUBJECT = 'DISCIPLINA – Votre Analyse du Besoin à signer';

export const AB_SIGNATURE_BODY = `<p>Bonjour,</p>
<p>Je vous remercie pour notre échange téléphonique et pour l'intérêt que vous portez au recrutement d'un apprenti au sein de {{entreprise}}.</p>
<p><strong>— Documents à signer électroniquement —</strong><br/>
Deux documents vous attendent, à signer en ligne en quelques clics :</p>
<ul>
<li>L'Analyse du Besoin Entreprise (ABE) — pré-remplie avec les informations échangées pendant notre appel. Merci de vérifier, compléter si besoin, puis signer.</li>
<li>Le Mandat de publication d'offres d'emploi — qui nous autorise à diffuser une annonce anonyme correspondant précisément à votre besoin.</li>
</ul>
<p>{{lien_signature}}</p>
<p>La signature est simple, rapide et n'engendre aucun frais.</p>
<p>À savoir : nous lançons la recherche de profils dès maintenant. Avec votre ABE et votre Mandat signés, nous publions des offres dédiées à votre besoin — candidatures plus ciblées et plus qualifiées.</p>
<p><strong>— Prochaines étapes —</strong></p>
<ul>
<li>Transmission de votre dossier à notre service Recrutement</li>
<li>Un(e) chargé(e) de recrutement vous contacte pour affiner les critères</li>
<li>Vous recevez des candidatures pré-sélectionnées correspondant à vos attentes</li>
<li>Possibilité d'une semaine d'immersion gratuite avant signature définitive</li>
</ul>
<p>Je reste disponible pour toute question ou précision.</p>
<p>Bien cordialement,</p>
{{signature}}
<p style="font-size:12px;color:#888">*Contenu indicatif, non contractuel, susceptible de modifications.</p>`;
