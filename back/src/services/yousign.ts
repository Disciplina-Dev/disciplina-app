import path from 'path';
import { spawn } from 'child_process';
import { AnalyseBesoinRow } from '../repositories/interfaces';

const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || 'https://api-sandbox.yousign.app/v3';
const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY || '';
const YOUSIGN_TEMPLATE_ID = process.env.YOUSIGN_TEMPLATE_ID || '';

const PYTHON_SCRIPT = path.resolve(__dirname, '..', '..', '..', 'services', 'pdf_generator.py');

function yousignHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${YOUSIGN_API_KEY}`,
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

// ── PDF generation ──────────────────────────────────────────────────────────

export function generatePdf(ab: Partial<AnalyseBesoinRow>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const data = {
      ...ab,
      missions: typeof ab.missions === 'string' ? JSON.parse(ab.missions) : (ab.missions || []),
      jours_formation: typeof ab.jours_formation === 'string' ? JSON.parse(ab.jours_formation) : (ab.jours_formation || {}),
      rr_same_as_rl: ab.rr_same_as_rl === 1,
    };

    const proc = spawn('python3', [PYTHON_SCRIPT]);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString('utf8');
        return reject(new Error(`pdf_generator.py exited with code ${code}: ${errMsg}`));
      }
      resolve(Buffer.concat(chunks));
    });

    proc.on('error', (err) => reject(new Error(`Impossible de lancer python3: ${err.message}`)));

    proc.stdin.write(JSON.stringify(data), 'utf8');
    proc.stdin.end();
  });
}

// ── YouSign — Upload document ───────────────────────────────────────────────

export async function uploadDocument(pdfBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([pdfBuffer], { type: 'application/pdf' }),
    filename,
  );
  formData.append('nature', 'signable_document');

  const res = await fetch(`${YOUSIGN_API_URL}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${YOUSIGN_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouSign uploadDocument ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

// ── YouSign — Créer signature request ──────────────────────────────────────

import { PDFDocument } from 'pdf-lib';

export async function createSignatureRequest(
  documentId: string,
  ab: Partial<AnalyseBesoinRow>,
  pdfBuffer: Buffer
): Promise<string> {
  // Obtenir le nombre de pages réelles du document pour placer la signature à la fin
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  // Signataire = représentant légal (ou responsable recrutement si différent)
  const signerFirstName = (ab.rl_nom || '').split(' ').slice(0, -1).join(' ') || ab.rl_nom || 'Représentant';
  const signerLastName  = (ab.rl_nom || '').split(' ').slice(-1)[0] || 'Légal';

  // YouSign exige un Tél E.164 valide rééllement (ex: libphonenumber)
  let phone = (ab.rl_telephone || '').replace(/\s+/g, '');
  if (phone.startsWith('0692') || phone.startsWith('0693')) {
    phone = '+262' + phone.substring(1);
  } else if (phone.startsWith('0')) {
    phone = '+33' + phone.substring(1);
  }
  // Numéro de test valide si invalide
  if (phone.length < 10) phone = '+33612345678';

  // Email strictement valide
  let email = (ab.rl_email || '').trim();
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    email = 'epitechdisciplina.dev@gmail.com';
  }

  const payload = {
    name: `AB — ${ab.raison_sociale || 'Entreprise'}`,
    delivery_mode: 'none',
    timezone: 'Indian/Reunion',
    // Dans YouSign v3, c'est simplement un tableau de strings contenant les IDs
    documents: [documentId],
    signers: [
      {
        info: {
          first_name: signerFirstName.substring(0, 50),
          last_name: signerLastName.substring(0, 50),
          email: email,
          phone_number: phone,
          locale: 'fr',
        },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'otp_sms',
        fields: [
          {
            type: 'signature',
            document_id: documentId,
            page: totalPages,
            x: 60,
            y: 80,
            width: 200,
            height: 90
          }
        ]
      },
    ],
  };

  const res = await fetch(`${YOUSIGN_API_URL}/signature_requests`, {
    method: 'POST',
    headers: yousignHeaders('application/json'),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouSign createSignatureRequest ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

// ── YouSign — Activer ───────────────────────────────────────────────────────

export async function activateSignatureRequest(signatureRequestId: string): Promise<void> {
  const res = await fetch(
    `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/activate`,
    {
      method: 'POST',
      headers: yousignHeaders('application/json'),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouSign activate ${res.status}: ${body}`);
  }
}

// ── YouSign — Récupérer lien direct ─────────────────────────────────────────

export async function getSignatureLink(signatureRequestId: string): Promise<string> {
  // Fetch the signers list specifically, as it contains signature_link in API V3
  const res = await fetch(`${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/signers`, {
    headers: yousignHeaders('application/json'),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouSign getSignatureLink ${res.status}: ${body}`);
  }

  const parsed = await res.json() as any;
  const signersArray = Array.isArray(parsed) ? parsed : (parsed?.data || []);

  if (!signersArray || signersArray.length === 0) {
    console.error('Signer fetch response:', JSON.stringify(parsed, null, 2));
    throw new Error('YouSign getSignatureLink: Aucun signataire trouvé ou signature_link non disponible.');
  }

  const link = signersArray[0].signature_link;
  if (!link) {
    console.error('Signer dump:', JSON.stringify(signersArray[0], null, 2));
    throw new Error('YouSign getSignatureLink: Le lien de signature est vide.');
  }

  return link;
}

// ── YouSign — Récupérer PDF signé ──────────────────────────────────────────

export async function getSignedDocument(signatureRequestId: string): Promise<Buffer> {
  const res = await fetch(
    `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents/download`,
    { headers: { Authorization: `Bearer ${YOUSIGN_API_KEY}` } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouSign getSignedDocument ${res.status}: ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
