import { env } from '../../config/env';
import { logger } from '../logger/logger';

function sanitizeName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-zA-Z0-9\s\-']/g, '') // keep only alphanum, space, hyphen, apostrophe
        .trim()
        .slice(0, 50); // Yousign max length
}

export class YousignService {
    private getHeaders() {
        return {
            'Authorization': `Bearer ${env.YOUSIGN_API_KEY}`,
            'Accept': 'application/json'
        };
    }

    async initiateSignatureProcedure(
        pdfBuffer: Buffer,
        fileName: string,
        signerEmail: string,
        signerFirstName: string,
        signerLastName: string,
        lastPage: number = 1
    ): Promise<string | null> {
        // If the API key is not configured or left as placeholder, we mock the Yousign interaction in sandbox mode
        if (!env.YOUSIGN_API_KEY || env.YOUSIGN_API_KEY === 'sandbox_yousign_key_placeholder') {
            logger.warn('YOUSIGN_API_KEY is not configured. Simulating successful Yousign procedure signature request.');
            return `mock-yousign-req-${Date.now()}`;
        }

        try {
            // 1. Create Signature Request
            logger.info('Creating signature request on Yousign...');
            const createReqRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests`, {
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `Analyse du Besoin - ${fileName.replace('.pdf', '')}`,
                    delivery_mode: 'email',
                    timezone: 'Europe/Paris'
                })
            });

            if (!createReqRes.ok) {
                const errText = await createReqRes.text();
                throw new Error(`Failed to create signature request: ${createReqRes.status} ${errText}`);
            }

            const signatureRequest = await createReqRes.json();
            const signatureRequestId = signatureRequest.id;
            logger.info(`Signature request created successfully with ID: ${signatureRequestId}`);

            // 2. Upload Document
            logger.info(`Uploading document ${fileName} to Yousign...`);
            const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('nature', 'signable_document');

            const uploadRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents`, {
                method: 'POST',
                headers: this.getHeaders(), // No Content-Type, native FormData handles it
                body: formData
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Failed to upload document: ${uploadRes.status} ${errText}`);
            }

            const documentObj = await uploadRes.json();
            const documentId = documentObj.id;
            logger.info(`Document uploaded successfully with ID: ${documentId}`);

            // 3. Add Signer
            logger.info(`Adding signer ${signerEmail} to Yousign signature request...`);
            const signerRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/signers`, {
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    info: {
                        first_name: sanitizeName(signerFirstName || 'Responsable'),
                        last_name: sanitizeName(signerLastName || 'Recrutement'),
                        email: signerEmail,
                        locale: 'fr'
                    },
                    signature_level: 'electronic_signature',
                    signature_authentication_mode: 'no_otp',
                    fields: [
                        {
                            type: 'signature',
                            document_id: documentId,
                            page: lastPage,
                            x: 350,
                            y: 550
                        }
                    ]
                })
            });

            if (!signerRes.ok) {
                const errText = await signerRes.text();
                throw new Error(`Failed to add signer: ${signerRes.status} ${errText}`);
            }

            const signerObj = await signerRes.json();
            logger.info(`Signer added successfully with ID: ${signerObj.id}`);

            // 4. Activate Signature Request
            logger.info('Activating signature request...');
            const activateRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/activate`, {
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!activateRes.ok) {
                const errText = await activateRes.text();
                throw new Error(`Failed to activate signature request: ${activateRes.status} ${errText}`);
            }

            logger.info('Signature request activated successfully.');
            return signatureRequestId;

        } catch (error) {
            logger.error(error, 'Yousign integration failed');
            throw error;
        }
    }

    async downloadSignedDocument(signatureRequestId: string): Promise<Buffer | null> {
        if (!env.YOUSIGN_API_KEY || env.YOUSIGN_API_KEY === 'sandbox_yousign_key_placeholder') {
            logger.warn('YOUSIGN_API_KEY is placeholder. Returning a mock PDF buffer.');
            return Buffer.from('mock-signed-pdf-content');
        }

        try {
            // First, get documents associated with the signature request to find the signable document's ID
            logger.info(`Listing documents for signature request: ${signatureRequestId}`);
            const docsRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!docsRes.ok) {
                throw new Error(`Failed to list documents: ${docsRes.status}`);
            }

            const docs = await docsRes.json();
            const signableDoc = docs.find((d: any) => d.nature === 'signable_document');
            if (!signableDoc) {
                throw new Error('No signable document found in signature request');
            }

            const documentId = signableDoc.id;

            // Now, download the document
            logger.info(`Downloading signed document ${documentId} for request ${signatureRequestId}...`);
            const downloadRes = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents/${documentId}/download`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!downloadRes.ok) {
                throw new Error(`Failed to download signed document: ${downloadRes.status}`);
            }

            const arrayBuffer = await downloadRes.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            logger.error(error, 'Failed to download signed document from Yousign');
            return null;
        }
    }
}
