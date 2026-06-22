import * as fs from 'fs';
import * as path from 'path';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

const PLACEHOLDER_KEY = 'docuseal_key_placeholder';
const MOCK_PREFIX = 'mock-docuseal-sub-';

const SIGNER_ROLE = 'Responsable';

// Mandat de publication d'offre d'emploi, joint à l'Analyse du Besoin et signé
// par le même signataire (rôle Responsable). Le mandant signe la colonne de
// gauche : « Lu et approuvé », signature et date (cf. zone bas-gauche du PDF).
const MANDAT_FILENAME = 'Mandat pour la publication d’une offre d’emploi (1).pdf';

/** Charge le PDF du mandat depuis back/assets. Renvoie null si introuvable. */
function loadMandatPdf(): Buffer | null {
    try {
        // docuseal.service.ts est à src/external/docuseal → remonter 3 niveaux
        // pour atteindre back/assets (idem dist/external/docuseal en prod).
        const mandatPath = path.join(__dirname, '../../../assets', MANDAT_FILENAME);
        return fs.readFileSync(mandatPath);
    } catch (err) {
        logger.error({ err }, '[DocuSeal] Mandat PDF introuvable dans assets/');
        return null;
    }
}

/**
 * Document « Mandat » pour le payload DocuSeal /templates/pdf, avec les champs
 * à remplir par le mandant (colonne de gauche, bas de page) :
 *   - texte « Lu et approuvé »
 *   - signature
 *   - date de signature
 * Coordonnées en ratio 0..1, origine haut-gauche, page 1-based.
 */
function buildMandatDocument(mandatBuffer: Buffer) {
    return {
        name: 'Mandat de publication',
        file: mandatBuffer.toString('base64'),
        fields: [
            {
                name: 'Mandat - Date',
                type: 'date',
                role: SIGNER_ROLE,
                // À côté du libellé « Le : »
                areas: [{ page: 1, x: 0.14, y: 0.783, w: 0.22, h: 0.025 }],
            },
            {
                name: 'Mandat - Lu et approuvé',
                type: 'text',
                role: SIGNER_ROLE,
                // Colonne de gauche, sous « Signature, cachet, "Lu et approuvé" »
                areas: [{ page: 1, x: 0.13, y: 0.885, w: 0.3, h: 0.03 }],
            },
            {
                name: 'Mandat - Signature',
                type: 'signature',
                role: SIGNER_ROLE,
                areas: [{ page: 1, x: 0.13, y: 0.915, w: 0.3, h: 0.05 }],
            },
        ],
    };
}

// Email "à signer" envoyé par DocuSeal au signataire.
// Variables disponibles : {{template.name}}, {{submitter.link}}, {{account.name}}.
const SIGNATURE_EMAIL_SUBJECT = 'Signature de votre Analyse du Besoin';
const SIGNATURE_EMAIL_BODY = [
    'Bonjour,',
    '',
    'Dans le cadre de votre projet de recrutement en apprentissage avec Disciplina,',
    'nous vous invitons à signer électroniquement votre Analyse du Besoin',
    'ainsi que le mandat de publication d’offre d’emploi.',
    '',
    'Cliquez sur le bouton ci-dessous pour consulter et signer le document :',
    '{{submitter.link}}',
    '',
    "La signature est simple, rapide et n'engendre aucun frais.",
    '',
    'Cordialement,',
    "L'équipe Disciplina",
].join('\n');

/**
 * Wrapper de l'API DocuSeal (https://www.docuseal.com/docs/api).
 *
 * Conserve la même interface publique que l'ancien YousignService afin que le
 * reste du code (NeedsAnalysisService, webhook) n'ait pas à connaître le
 * fournisseur de signature.
 */
export class DocuSealService {
    private isMock(): boolean {
        return !env.DOCUSEAL_API_KEY || env.DOCUSEAL_API_KEY === PLACEHOLDER_KEY;
    }

    private headers(extra?: Record<string, string>): Record<string, string> {
        return {
            'X-Auth-Token': env.DOCUSEAL_API_KEY ?? '',
            Accept: 'application/json',
            ...extra,
        };
    }

    /**
     * Crée un template DocuSeal à partir du PDF généré, puis une submission
     * envoyée par email au signataire. Renvoie l'identifiant de submission.
     */
    async initiateSignatureProcedure(
        pdfBuffer: Buffer,
        fileName: string,
        signerEmail: string,
        signerFirstName: string,
        signerLastName: string,
        lastPage: number = 1,
    ): Promise<string | null> {
        if (this.isMock()) {
            logger.warn('DOCUSEAL_API_KEY not configured. Simulating a successful DocuSeal submission.');
            return `${MOCK_PREFIX}${Date.now()}`;
        }

        const base = env.DOCUSEAL_BASE_URL;
        const signerName = `${signerFirstName ?? ''} ${signerLastName ?? ''}`.trim() || 'Responsable recrutement';

        try {
            // 1. Créer un template à partir des PDF (Analyse du Besoin + Mandat).
            //    DocuSeal utilise des coordonnées en ratio (0..1) et des pages 1-based.
            //    Le mandat est joint comme 2e document, signé par le même signataire.
            logger.info('Creating DocuSeal template from PDF...');

            const documents: unknown[] = [
                {
                    name: fileName.replace(/\.pdf$/i, ''),
                    file: pdfBuffer.toString('base64'),
                    fields: [
                        {
                            name: 'Signature',
                            type: 'signature',
                            role: SIGNER_ROLE,
                            // Bas-droite de la dernière page, dans la zone
                            // « Signature électronique de l'entreprise » du PDF
                            // (bloc right ~48%, hauteur ~120px en bas de page).
                            // DocuSeal numérote les pages à partir de 1 (pas 0-based).
                            areas: [
                                {
                                    page: Math.max(1, lastPage),
                                    x: 0.52,
                                    y: 0.8,
                                    w: 0.36,
                                    h: 0.1,
                                },
                            ],
                        },
                    ],
                },
            ];

            const mandatBuffer = loadMandatPdf();
            if (mandatBuffer) {
                documents.push(buildMandatDocument(mandatBuffer));
            } else {
                logger.warn('[DocuSeal] Mandat non joint (PDF introuvable) — envoi de l’AB seule.');
            }

            const templateRes = await fetch(`${base}/templates/pdf`, {
                method: 'POST',
                headers: this.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    name: `Analyse du Besoin - ${fileName.replace(/\.pdf$/i, '')}`,
                    documents,
                }),
            });

            if (!templateRes.ok) {
                const errText = await templateRes.text();
                throw new Error(`Failed to create DocuSeal template: ${templateRes.status} ${errText}`);
            }

            const template = await templateRes.json();
            const templateId = template.id;
            logger.info(`DocuSeal template created with ID: ${templateId}`);

            // 2. Créer la submission et envoyer l'email au signataire.
            logger.info(`Creating DocuSeal submission for ${signerEmail}...`);
            const submissionRes = await fetch(`${base}/submissions`, {
                method: 'POST',
                headers: this.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    template_id: templateId,
                    send_email: true,
                    message: {
                        subject: SIGNATURE_EMAIL_SUBJECT,
                        body: SIGNATURE_EMAIL_BODY,
                    },
                    submitters: [{ role: SIGNER_ROLE, email: signerEmail, name: signerName }],
                }),
            });

            if (!submissionRes.ok) {
                const errText = await submissionRes.text();
                throw new Error(`Failed to create DocuSeal submission: ${submissionRes.status} ${errText}`);
            }

            const submitters = await submissionRes.json();
            // L'endpoint renvoie la liste des submitters créés ; tous partagent le même submission_id.
            const submissionId =
                Array.isArray(submitters) && submitters.length > 0
                    ? submitters[0].submission_id
                    : (submitters?.submission_id ?? submitters?.id);

            if (!submissionId) {
                throw new Error('DocuSeal submission created but no submission id was returned');
            }

            logger.info(`DocuSeal submission created with ID: ${submissionId}`);
            return String(submissionId);
        } catch (error) {
            logger.error({ err: error }, 'DocuSeal integration failed');
            throw error;
        }
    }

    /** Télécharge le PDF signé combiné d'une submission terminée. */
    async downloadSignedDocument(submissionId: string): Promise<Buffer | null> {
        if (this.isMock() || submissionId.startsWith(MOCK_PREFIX)) {
            logger.warn('DocuSeal mock mode (placeholder key or mock id). Returning a mock PDF buffer.');
            return Buffer.from('mock-signed-pdf-content');
        }

        try {
            const res = await fetch(`${env.DOCUSEAL_BASE_URL}/submissions/${submissionId}`, {
                method: 'GET',
                headers: this.headers(),
            });
            if (!res.ok) {
                throw new Error(`Failed to fetch DocuSeal submission: ${res.status}`);
            }

            const submission = await res.json();
            const documents: Array<{ name?: string; url?: string }> = submission.documents ?? [];
            const signedUrl = documents.find((d) => d.url)?.url ?? submission.combined_document_url;
            if (!signedUrl) {
                throw new Error('No signed document URL found in DocuSeal submission');
            }

            const fileRes = await fetch(signedUrl);
            if (!fileRes.ok) {
                throw new Error(`Failed to download signed document: ${fileRes.status}`);
            }
            const arrayBuffer = await fileRes.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            logger.error({ err: error }, 'Failed to download signed document from DocuSeal');
            return null;
        }
    }
}
