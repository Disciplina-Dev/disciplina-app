const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function sendAbLink(params: {
  token: string;
  raisonSociale: string;
  recipientEmail: string;
  recipientName: string;
}): Promise<void> {
  const { token, raisonSociale, recipientEmail, recipientName } = params;
  const link = `${FRONTEND_URL}/ab/${token}`;

  const payload = {
    sender: { name: 'Disciplina', email: 'epitechdisciplina.dev@gmail.com' },
    to: [{ email: recipientEmail, name: recipientName }],
    subject: `Analyse de Besoin — ${raisonSociale}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <div style="background: #1130A7; padding: 32px 40px;">
          <h1 style="color: white; font-size: 22px; margin: 0;">Disciplina</h1>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 8px 0 0;">Analyse de Besoin</p>
        </div>
        <div style="padding: 32px 40px;">
          <p style="font-size: 15px; margin: 0 0 16px;">Bonjour ${recipientName},</p>
          <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 24px;">
            Votre conseiller Disciplina a préparé une Analyse de Besoin pour <strong>${raisonSociale}</strong>.
            Merci de prendre quelques minutes pour vérifier les informations et valider le document.
          </p>
          <a href="${link}" style="display: inline-block; background: #1130A7; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Accéder au formulaire
          </a>
          <p style="font-size: 12px; color: #999; margin: 24px 0 0; line-height: 1.6;">
            Ce lien est valable 14 jours. Si vous ne pouvez pas cliquer sur le bouton, copiez-collez ce lien dans votre navigateur :<br />
            <a href="${link}" style="color: #1130A7;">${link}</a>
          </p>
        </div>
      </div>
    `,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo sendAbLink ${res.status}: ${body}`);
  }
}

export async function sendSignedPdfEmail(params: {
  raisonSociale: string;
  pdfBuffer: Buffer;
}): Promise<void> {
  const { raisonSociale, pdfBuffer } = params;

  const payload = {
    sender: { name: 'Disciplina', email: 'epitechdisciplina.dev@gmail.com' },
    to: [{ email: 'epitechdisciplina.dev@gmail.com', name: 'Disciplina Admin' }],
    subject: `Analyse de Besoin Signée — ${raisonSociale}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <div style="padding: 20px;">
          <p style="font-size: 15px; margin: 0 0 16px;">Bonjour,</p>
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            L'entreprise <strong>${raisonSociale}</strong> vient de signer son Analyse de Besoin via YouSign.
          </p>
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Veuillez trouver le document final signé en pièce jointe de cet email.
          </p>
        </div>
      </div>
    `,
    attachment: [
      {
        name: 'AB_Signee_' + raisonSociale.replace(/\s+/g, '_') + '.pdf',
        content: pdfBuffer.toString('base64'),
      }
    ]
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error('Brevo sendSignedPdfEmail ' + res.status + ': ' + body);
  }
}
