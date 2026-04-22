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
      missions: ab.missions ? JSON.parse(ab.missions as string) : [],
      jours_formation: ab.jours_formation ? JSON.parse(ab.jours_formation as string) : {},
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

export async function createSignatureRequest(
  documentId: string,
  ab: Partial<AnalyseBesoinRow>,
): Promise<string> {
  // Signataire = représentant légal (ou responsable recrutement si différent)
  const signerFirstName = (ab.rl_nom || '').split(' ').slice(0, -1).join(' ') || ab.rl_nom || '';
  const signerLastName  = (ab.rl_nom || '').split(' ').slice(-1)[0] || '';

  const payload = {
    name: `AB — ${ab.raison_sociale || 'Entreprise'}`,
    delivery_mode: 'email',
    timezone: 'Indian/Reunion',
    template_id: YOUSIGN_TEMPLATE_ID || undefined,
    documents: [{ document_id: documentId }],
    signers: [
      {
        info: {
          first_name: signerFirstName,
          last_name: signerLastName,
          email: ab.rl_email || '',
          phone_number: ab.rl_telephone || '',
          locale: 'fr',
        },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'otp_sms',
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
