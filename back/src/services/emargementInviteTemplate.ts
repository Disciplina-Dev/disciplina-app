export const EMARGEMENT_INVITE_SUBJECT = 'DISCIPLINA – Émargement de la séance du {{date}}';

export const EMARGEMENT_INVITE_BODY = `<p>Bonjour {{formateur}},</p>
<p>Vous êtes invité(e) à émarger la séance <strong>{{session}}</strong> du <strong>{{date}}</strong>
({{heure}}), sur le site {{site}} ({{mode}}).</p>
<p>Ouvrez la page d'émargement pour suivre les présences des alternants, afficher le QR code
de signature, puis confirmer et signer la feuille à la fin des créneaux :</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{{link}}" style="background-color:#0f766e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Ouvrir l'émargement</a>
</p>
<p>Ce lien reste valable jusqu'à la fin de la journée de la séance.</p>
<p>Si vous n'êtes pas le formateur concerné, vous pouvez ignorer cet e-mail.</p>
<p>Cordialement,</p>
<p><strong>L'équipe DISCIPLINA</strong></p>`;
