import { env } from '../../config/env';
import { logger } from '../logger/logger';

const PLACEHOLDER_KEY = 'docuseal_key_placeholder';
const MOCK_PREFIX = 'mock-docuseal-sub-';

const SIGNER_ROLE = 'Responsable';

// Email "à signer" envoyé par DocuSeal au signataire.
// Variables disponibles : {{template.name}}, {{submitter.link}}, {{account.name}}.
const SIGNATURE_EMAIL_SUBJECT = 'Signature de votre Analyse du Besoin';
const SIGNATURE_EMAIL_BODY = [
    'Bonjour,',
    '',
    'Dans le cadre de votre projet de recrutement en apprentissage avec Disciplina,',
    'nous vous invitons à signer électroniquement votre Analyse du Besoin.',
    '',
    'Cliquez sur le bouton ci-dessous pour consulter et signer le document :',
    '{{submitter.link}}',
    '',
    "La signature est simple, rapide et n'engendre aucun frais.",
    '',
    "Cordialement,",
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
            // 1. Créer un template à partir du PDF avec un champ signature.
            //    DocuSeal utilise des coordonnées en ratio (0..1) et des pages 0-based.
            logger.info('Creating DocuSeal template from PDF...');
            const templateRes = await fetch(`${base}/templates/pdf`, {
                method: 'POST',
                headers: this.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    name: `Analyse du Besoin - ${fileName.replace(/\.pdf$/i, '')}`,
                    documents: [
                        {
                            name: fileName.replace(/\.pdf$/i, ''),
                            file: pdfBuffer.toString('base64'),
                            fields: [
                                {
                                    name: 'Signature',
                                    type: 'signature',
                                    role: SIGNER_ROLE,
                                    // Bas-droite de la dernière page, aligné sur le bloc
                                    // « Signature et cachet de l'entreprise » du PDF (right 48%).
                                    areas: [
                                        {
                                            page: Math.max(0, lastPage - 1),
                                            x: 0.55,
                                            y: 0.85,
                                            w: 0.33,
                                            h: 0.06,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
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
                    : submitters?.submission_id ?? submitters?.id;

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
