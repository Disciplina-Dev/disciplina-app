import * as fs from 'fs';
import * as path from 'path';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

const PLACEHOLDER_KEY = 'docuseal_key_placeholder';
const MOCK_PREFIX = 'mock-docuseal-sub-';

const SIGNER_ROLE = 'Responsable';

/** Un document signé téléchargé depuis DocuSeal, conservé distinct. */
export interface SignedDocument {
    name: string;
    buffer: Buffer;
}

// Mandat de publication d'offre d'emploi, joint à l'Analyse du Besoin comme
// document distinct et signé par le même signataire (rôle Responsable). Le PDF
// est conservé tel quel ; seule une zone de signature est ajoutée (bas-gauche).
const MANDAT_FILENAME = 'Mandat pour la publication d’une offre d’emploi (1).pdf';

// Catalogue Disciplina, joint à l'envoi en signature comme document distinct
// SANS champ : le signataire le consulte mais n'a rien à y signer.
const CATALOGUE_FILENAME = 'Catalogue Disciplina.pdf';

/**
 * Charge un PDF depuis assets/. Essaie d'abord un chemin relatif à
 * `process.cwd()` (fiable dans la lambda Vercel où les fichiers `includeFiles`
 * sont déposés à la racine de la fonction), puis retombe sur `__dirname` (dev
 * local / `node dist`). Renvoie null si introuvable.
 */
function loadAssetPdf(filename: string): Buffer | null {
    const candidates = [
        path.join(process.cwd(), 'assets', filename),
        path.join(__dirname, '../../assets', filename),
    ];
    for (const candidate of candidates) {
        try {
            return fs.readFileSync(candidate);
        } catch {
            // chemin suivant
        }
    }
    logger.error({ filename, candidates }, '[DocuSeal] PDF introuvable dans assets/');
    return null;
}

function loadMandatPdf(): Buffer | null {
    return loadAssetPdf(MANDAT_FILENAME);
}

function loadCataloguePdf(): Buffer | null {
    return loadAssetPdf(CATALOGUE_FILENAME);
}

/** Exposé pour l'aperçu avant envoi : sert les PDF statiques (mandat / catalogue). */
export const signatureAssets = {
    mandat: loadMandatPdf,
    catalogue: loadCataloguePdf,
};

/**
 * Document « Mandat » pour le payload DocuSeal /templates/pdf. Le PDF d'origine
 * est conservé tel quel ; on ajoute les zones à remplir par le signataire :
 * l'identité du mandant (responsable, raison sociale, SIRET, adresse, code APE),
 * « Fait à » (texte), « Le » (date), « Lu et approuvé » (texte) et la signature.
 * Coordonnées en ratio 0..1, origine haut-gauche, page 1-based.
 */
function buildMandatDocument(mandatBuffer: Buffer) {
    return {
        name: 'Mandat de publication',
        file: mandatBuffer.toString('base64'),
        fields: [
            {
                name: 'Nom et prénom du / de la responsable',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.43, y: 0.19, w: 0.44, h: 0.016 }],
            },
            {
                name: 'Dénomination ou raison sociale',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.45, y: 0.207, w: 0.42, h: 0.016 }],
            },
            {
                name: 'Numéro de SIRET',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.28, y: 0.225, w: 0.45, h: 0.016 }],
            },
            {
                name: 'Adresse du siège',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.28, y: 0.241, w: 0.45, h: 0.016 }],
            },
            {
                name: 'Code APE',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.24, y: 0.257, w: 0.45, h: 0.016 }],
            },
            {
                name: 'Fait à',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.24, y: 0.745, w: 0.22, h: 0.028 }],
            },
            {
                name: 'Le',
                type: 'date',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.19, y: 0.775, w: 0.22, h: 0.028 }],
            },
            {
                name: 'Lu et approuvé',
                type: 'text',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.18, y: 0.875, w: 0.3, h: 0.03 }],
            },
            {
                name: 'Mandat - Signature',
                type: 'signature',
                role: SIGNER_ROLE,
                required: true,
                areas: [{ page: 1, x: 0.13, y: 0.915, w: 0.3, h: 0.05 }],
            },
        ],
    };
}

// Email "à signer" envoyé par DocuSeal au signataire.
// Variables disponibles : {{template.name}}, {{submitter.link}}, {{account.name}}.
export const SIGNATURE_EMAIL_SUBJECT = 'DISCIPLINA – Votre Analyse du Besoin à signer';
export const SIGNATURE_EMAIL_BODY = [
    'Bonjour,',
    '',
    "Je vous remercie pour notre échange téléphonique et pour l'intérêt que vous portez au recrutement d'un apprenti au sein de votre entreprise.",
    '',
    '— Documents à signer électroniquement —',
    'Deux documents vous attendent, à signer en ligne en quelques clics via le bouton ci-dessous :',
    "• L'Analyse du Besoin Entreprise (ABE) — pré-remplie avec les informations échangées pendant notre appel. Merci de vérifier, compléter si besoin, puis signer.",
    "• Le Mandat de publication d'offres d'emploi — qui nous autorise à diffuser une annonce anonyme correspondant précisément à votre besoin.",
    '',
    '{{submitter.link}}',
    '',
    "La signature est simple, rapide et n'engendre aucun frais.",
    '',
    'À savoir : nous lançons la recherche de profils dès maintenant. Avec votre ABE et votre Mandat signés, nous publions des offres dédiées à votre besoin — candidatures plus ciblées et plus qualifiées.',
    '',
    '— Prochaines étapes —',
    '• Transmission de votre dossier à notre service Recrutement',
    '• Un(e) chargé(e) de recrutement vous contacte pour affiner les critères',
    '• Vous recevez des candidatures pré-sélectionnées correspondant à vos attentes',
    "• Possibilité d'une semaine d'immersion gratuite avant signature définitive",
    '',
    '— Aides financières 2026 (rappel) —',
    'Contrats conclus dès le 8 mars 2026, débutant avant le 1er janvier 2027.',
    'Aides à l’embauche (entreprises de moins de 250 salariés) :',
    '• Bac (niveau 4) : 5 000 €',
    '• Bac+2 (niveau 5) : 4 500 €',
    '• Bac+3 (niveau 6) : 2 000 €',
    '• Apprenti en situation de handicap : 6 000 € (tous niveaux)',
    '',
    'Rémunération (base SMIC 2026 : 1 823,03 € brut/mois) :',
    '1ʳᵉ année — 18-20 ans : 783,90 € · 21-25 ans : 966,21 € · 26 ans et + : 1 823,03 €',
    '2ᵉ année — 18-20 ans : 929,75 € · 21-25 ans : 1 112,05 € · 26 ans et + : 1 823,03 €',
    '',
    "S'ajoute l'exonération totale ou partielle des charges sociales selon la taille de l'entreprise. Les aides sont versées mensuellement par l'ASP pendant la première année du contrat.",
    '',
    'Je reste disponible pour toute question ou précision.',
    'Bien cordialement,',
    "L'équipe Disciplina",
    '',
    '*Contenu indicatif, non contractuel, susceptible de modifications.',
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
                            required: true,
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

            // Catalogue joint comme document à consulter, SANS champ (rien à signer).
            const catalogueBuffer = loadCataloguePdf();
            if (catalogueBuffer) {
                documents.push({ name: 'Catalogue Disciplina', file: catalogueBuffer.toString('base64') });
            } else {
                logger.warn('[DocuSeal] Catalogue non joint (PDF introuvable).');
            }

            logger.info(
                {
                    docCount: documents.length,
                    docNames: documents.map((d) => (d as { name?: string }).name),
                    mandatLoaded: !!mandatBuffer,
                },
                '[DocuSeal] documents préparés pour le template',
            );

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
            logger.info(
                {
                    templateId,
                    templateDocCount: Array.isArray(template.documents) ? template.documents.length : undefined,
                    templateDocNames: Array.isArray(template.documents)
                        ? template.documents.map((d: { name?: string }) => d.name)
                        : undefined,
                    schemaCount: Array.isArray(template.schema) ? template.schema.length : undefined,
                },
                '[DocuSeal] template créé',
            );

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

    /**
     * Télécharge les documents signés d'une submission terminée, en gardant
     * chaque PDF distinct (Analyse du Besoin et Mandat séparés, pas le combiné).
     * Renvoie une liste vide en cas d'échec.
     */
    async downloadSignedDocuments(submissionId: string): Promise<SignedDocument[]> {
        if (this.isMock() || submissionId.startsWith(MOCK_PREFIX)) {
            logger.warn('DocuSeal mock mode (placeholder key or mock id). Returning mock signed documents.');
            return [
                { name: 'Analyse du Besoin', buffer: Buffer.from('mock-signed-ab-content') },
                { name: 'Mandat de publication', buffer: Buffer.from('mock-signed-mandat-content') },
            ];
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
            logger.info(
                {
                    submissionId,
                    docCount: documents.length,
                    docs: documents.map((d) => ({ name: d.name, hasUrl: !!d.url })),
                    hasCombined: !!submission.combined_document_url,
                },
                '[DocuSeal] documents signés reçus',
            );
            const withUrl = documents.filter((d) => d.url);
            if (withUrl.length === 0) {
                throw new Error('No signed document URL found in DocuSeal submission');
            }

            const downloaded = await Promise.all(
                withUrl.map(async (doc, index) => {
                    const fileRes = await fetch(doc.url as string);
                    if (!fileRes.ok) {
                        throw new Error(`Failed to download signed document: ${fileRes.status}`);
                    }
                    const arrayBuffer = await fileRes.arrayBuffer();
                    return { name: doc.name || `document-${index + 1}`, buffer: Buffer.from(arrayBuffer) };
                }),
            );
            return downloaded;
        } catch (error) {
            logger.error({ err: error }, 'Failed to download signed documents from DocuSeal');
            return [];
        }
    }
}
