import { Request, Response } from 'express';
import { NeedsAnalysisRepository } from '../../repositories/mongo/NeedsAnalysisRepository';
import { toNeedsAnalysis } from '../../services/mappers/needsAnalysis.mapper';
import { NeedsAnalysisStatus } from '../../types/needsAnalysisNoSql.types';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { CompaniesService } from '../../services/CompaniesService';
import { YousignService } from '../../external/yousign/yousign.service';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { MailTemplateService } from '../../services/MailTemplateService';
import { logger } from '../../external/logger';
import { JobRole } from '../../types/user.types';
import { notifyUser } from './sse';

const needsAnalysisRepo = new NeedsAnalysisRepository();
const userRepo = new UserRepository();
const companiesService = new CompaniesService();
const yousignService = new YousignService();
const gmailService = new GoogleGmailService();
const mailTemplateService = new MailTemplateService();

export async function handleYousignWebhook(req: Request, res: Response): Promise<void> {
    const eventName = req.body.eventName || req.body.event;
    const signatureRequestId =
        req.body.data?.id || req.body.signature_request?.id || req.body.procedure?.id || req.body.id;

    logger.info(`Received Yousign Webhook: Event = ${eventName}, SignatureRequestID = ${signatureRequestId}`);

    // We only process signed/completed events
    const isSignedEvent = [
        'procedure.signed',
        'procedure.done',
        'signature_request.signed',
        'signature_request.done',
    ].includes(eventName || '');

    if (!isSignedEvent) {
        logger.info(`Ignored Yousign Webhook event: ${eventName}`);
        res.status(200).json({ message: 'Event ignored' });
        return;
    }

    if (!signatureRequestId) {
        res.status(400).json({ error: 'Missing signature request ID' });
        return;
    }

    try {
        // 1. Find Needs Analysis in Mongo
        const doc = await needsAnalysisRepo.findBySignatureRequestId(signatureRequestId);
        if (!doc) {
            logger.warn(`No Needs Analysis found for Yousign Request ID: ${signatureRequestId}`);
            res.status(200).json({ message: 'No matching needs analysis record' });
            return;
        }
        const analysis = toNeedsAnalysis(doc);

        logger.info(`Found Needs Analysis record ID ${analysis.id} for Yousign Request ${signatureRequestId}`);

        // 2. Update status in Database
        await needsAnalysisRepo.update(analysis.id, { status: NeedsAnalysisStatus.SIGNE });
        logger.info(`Needs Analysis ID ${analysis.id} status updated to SIGNE`);

        // 3a. Notify commercial via SSE (real-time in-app)
        notifyUser(analysis.salerInfo?.id ?? 0, {
            type: 'ab_signed',
            abId: analysis.id,
            jobTitle: analysis.positions?.[0]?.title,
            companyId: analysis.companyInfos?.id,
        });

        // 3. Download the signed PDF from Yousign
        const pdfBuffer = await yousignService.downloadSignedDocument(signatureRequestId);
        if (!pdfBuffer) {
            logger.error(`Could not download signed PDF for request ${signatureRequestId}`);
            res.status(500).json({ error: 'Failed to download signed PDF' });
            return;
        }

        // 4. Fetch associated Commercial and Company details
        const commercial = analysis.salerInfo?.id ? await userRepo.findById(analysis.salerInfo.id) : null;
        const company = analysis.companyInfos?.id ? await companiesService.findById(analysis.companyInfos.id) : null;
        const companyName = company?.name || 'Entreprise';

        // 5. Send notification email using Gmail API
        // Try to find a user with valid Google OAuth credentials to dispatch the email
        let senderUser: any = commercial;
        if (!senderUser?.oauth_token || !senderUser?.refresh_token) {
            logger.warn(
                `Commercial owner ID ${analysis.salerInfo?.id} has no Google OAuth tokens. Searching for any administrative/commercial fallback account with tokens...`,
            );
            const allUsers = (await userRepo.findByRoleId(1)) || [];
            const fallback = allUsers.find((u: any) => u.oauth_token && u.refresh_token);
            if (fallback) {
                senderUser = fallback;
                logger.info(`Found fallback sender account: ${senderUser.email}`);
            } else {
                logger.error('No account with valid Google OAuth credentials found in database to dispatch the email.');
            }
        }

        if (senderUser && senderUser.oauth_token && senderUser.refresh_token) {
            const base64Pdf = pdfBuffer.toString('base64');
            const signatureHtml = await mailTemplateService
                .getSignatureHtml(senderUser.id, 'commercial')
                .catch(() => '');
            const mailOptions = {
                to: `${analysis.referents?.recruitmentReferents?.email || ''}, ${senderUser.email}`,
                subject: `[Disciplina] Fiche Analyse du Besoin Signée - ${companyName}`,
                text: `Bonjour,\n\nL'Analyse du Besoin pour ${companyName} a été signée avec succès.\nVous trouverez le PDF signé en pièce jointe.`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                        <div style="background-color: #0052cc; color: white; padding: 24px; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">DISCIPLINA</h2>
                            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Analyse du Besoin en Apprentissage</p>
                        </div>
                        <div style="padding: 24px; background-color: white;">
                            <p>Bonjour,</p>
                            <p>Nous avons le plaisir de vous informer que l'Analyse du Besoin en recrutement pour le poste de <strong>${analysis.positions?.[0]?.title}</strong> initiée pour <strong>${companyName}</strong> a été signée avec succès par les parties prenantes.</p>
                            <p>Le document officiel signé numériquement et revêtu du cachet électronique de conformité Yousign est joint à cet e-mail pour vos archives.</p>
                            <p>Notre équipe administrative prend désormais le relais pour organiser le rapprochement des profils candidats et planifier l'alternance.</p>
                            <br />
                            <p style="margin-bottom: 0;">Cordialement,</p>
                            <p style="margin-top: 4px; font-weight: bold; color: #0052cc;">L'équipe Relations Entreprises Disciplina</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #f0f0f0;">
                            Ceci est un e-mail automatique envoyé par l'application CRM Disciplina.
                        </div>
                    </div>
                    ${signatureHtml}
                `,
                attachment: {
                    content: base64Pdf,
                    filename: `Analyse_Besoin_${companyName.replace(/\s+/g, '_')}_Signee.pdf`,
                    contentType: 'application/pdf',
                },
            };

            const persistRefreshedTokens = (uid: number) => async (refreshed: any) => {
                logger.info(`Refreshed Google OAuth tokens for user ID ${uid}`);
                const userServiceModule = require('../../services/UserService');
                const userService = new userServiceModule.UserService();
                await userService.updateGoogleTokens(
                    uid,
                    refreshed.access_token ?? null,
                    refreshed.refresh_token ?? null,
                );
            };

            try {
                logger.info(`Sending signed PDF notification email from ${senderUser.email}...`);
                await gmailService.sendEmail(
                    { access_token: senderUser.oauth_token, refresh_token: senderUser.refresh_token },
                    mailOptions,
                    persistRefreshedTokens(senderUser.id),
                );
                logger.info('Notification email sent successfully!');
            } catch (err: any) {
                logger.error(err, 'Failed to send notification email via Google Gmail Service');
            }
        } else {
            logger.warn(
                'No Google OAuth account available to dispatch the signed PDF email. Proceeding anyway (status is still marked as SIGNE).',
            );
        }

        res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error: any) {
        logger.error(error, 'Error processing Yousign Webhook');
        res.status(500).json({ error: error.message });
    }
}
