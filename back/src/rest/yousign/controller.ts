import { Request, Response } from 'express';
import { NeedsAnalysisRepository } from '../../repositories/mongo/NeedsAnalysisRepository';
import { toNeedsAnalysis } from '../../services/mappers/needsAnalysis.mapper';
import { NeedsAnalysisStatus } from '../../types/needsAnalysisNoSql.types';
import { UserService } from '../../services/UserService';
import { CompaniesService } from '../../services/CompaniesService';
import { YousignService } from '../../external/yousign/yousign.service';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { withNoReply } from '../../external/google/no-reply';
import { MailTemplateService } from '../../services/MailTemplateService';
import { JobRole, Permission } from '../../types/user.types';
import { logger } from '../../external/logger';
import { notifyUser } from './sse';
import { getRegion, runForAllRegions } from '../../db/tenant';

const needsAnalysisRepo = new NeedsAnalysisRepository();
const userService = new UserService();
const companiesService = new CompaniesService();
const yousignService = new YousignService();
const gmailService = new GoogleGmailService();
const mailTemplateService = new MailTemplateService();

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function resolveCommercialMailSender(commercial: any | null): Promise<any | null> {
    if (commercial?.oauthToken && commercial.refreshToken) return commercial;
    if (commercial?.oauthToken) return commercial;
    try {
        const responsables = await userService.findByPermission(Permission.RESPONSABLE);
        const rcWithToken = responsables.filter((u: any) => u.role === JobRole.COMMERCIAL && u.oauthToken);
        const preferred = rcWithToken.find((u: any) => u.refreshToken) ?? rcWithToken[0];
        if (preferred) {
            logger.info({ fallbackUserId: preferred.id, fallbackEmail: preferred.email }, '[Yousign] Using Responsable Commercial as mail sender');
            return preferred;
        }
    } catch (err) {
        logger.warn({ err }, '[Yousign] Failed to resolve Responsable Commercial sender');
    }
    const fallback = await userService.findFirstGoogleConnectedUser([JobRole.COMMERCIAL]);
    if (fallback) {
        logger.info({ fallbackUserId: fallback.id, fallbackEmail: fallback.email }, '[Yousign] Using fallback Commercial as mail sender');
        return fallback;
    }
    return null;
}

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
        // Le webhook n'a pas de JWT : l'AB n'existe que dans UNE des deux bases
        // régionales. On cherche dans les deux (ALS par région), puis on traite
        // dans la région trouvée — les écritures MySQL/Mongo et le push SSE
        // repartent alors vers la bonne base et la bonne clé de canal.
        let processed = false;
        let responded = false;
        const respond = (status: number, body: unknown): void => {
            if (!responded) {
                res.status(status).json(body);
                responded = true;
            }
        };

        await runForAllRegions(async () => {
            if (processed) return;
            try {
                // 1. Find Needs Analysis in Mongo
                const doc = await needsAnalysisRepo.findBySignatureRequestId(signatureRequestId);
                if (!doc) return;
                // Idempotence (même garde que le flux DocuSeal) : un rejeu du
                // webhook ne doit ni renvoyer les mails ni recréer des notifs.
                if (doc.signed_notification_sent_at) {
                    logger.info(
                        { region: getRegion(), analysisId: doc._id },
                        '[Yousign] Duplicate webhook ignored, notifications already sent',
                    );
                    processed = true;
                    return;
                }
                if (doc.status === NeedsAnalysisStatus.SIGNE && !doc.signed_at) {
                    logger.info(
                        { region: getRegion(), analysisId: doc._id },
                        '[Yousign] Webhook ignored, AB already signed outside the automated flow',
                    );
                    processed = true;
                    return;
                }
                processed = true;
                const analysis = toNeedsAnalysis(doc);
                const region = getRegion();

                logger.info({ region, analysisId: analysis.id }, 'Found Needs Analysis record for Yousign request');

                // 2. Update status in Database
                await needsAnalysisRepo.update(analysis.id, {
                    status: NeedsAnalysisStatus.SIGNE,
                    signed_at: new Date(),
                });
                logger.info({ region, analysisId: analysis.id }, 'Needs Analysis ID status updated to SIGNE');

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
                    logger.error({ region }, `Could not download signed PDF for request ${signatureRequestId}`);
                    respond(500, { error: 'Failed to download signed PDF' });
                    return;
                }

                // 4. Fetch associated Commercial and Company details (decrypted tokens via UserService)
                const commercial = analysis.salerInfo?.id ? await userService.findById(analysis.salerInfo.id) : null;
                const company = analysis.companyInfos?.id ? await companiesService.findById(analysis.companyInfos.id) : null;
                const companyName = company?.name || (analysis.companyInfos as any)?.name || 'Entreprise';

                const safeName = companyName.replace(/\s+/g, '_');
                const filename = `Analyse_Besoin_${safeName}_Signee.pdf`;
                const base64Pdf = pdfBuffer.toString('base64');
                const attachments = [{ content: base64Pdf, filename, contentType: 'application/pdf' }];

                const commercialEmail = commercial?.email?.trim() || null;
                const senderForCommercial = await resolveCommercialMailSender(commercial);

                if (!commercialEmail) {
                    logger.warn({ analysisId: analysis.id }, '[Yousign] No commercial email — skipping commercial copy');
                } else if (!senderForCommercial?.oauthToken) {
                    logger.warn('[Yousign] No Google OAuth account available to dispatch the commercial copy. Status is still SIGNE.');
                } else {
                    const signatureHtml = await mailTemplateService.getSignatureHtml(senderForCommercial.id, 'commercial').catch(() => '');
                    const positionsList = (analysis.positions ?? [])
                        .map((p) => `${escapeHtml(p.title || 'Poste')} ${p.count ? `(x${p.count})` : ''}`.trim())
                        .filter(Boolean)
                        .join(', ') || '—';
                    const siret = (company as any)?.siret || (analysis.companyInfos as any)?.siret || '—';
                    const sectorLabel = (analysis.companyInfos as any)?.sector || '—';
                    const abId = analysis.id;

                    const persist = (uid: number) => async (refreshed: any) => {
                        await userService.updateGoogleTokens(uid, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
                    };

                    const commercialSubject = `[Disciplina] AB signée — ${companyName} — copie commerciale`;
                    const commercialHtml = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #0052cc; color: white; padding: 24px; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">DISCIPLINA</h2>
                            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Analyse du Besoin — copie commerciale</p>
                        </div>
                        <div style="padding: 24px; background-color: white;">
                            <p>Bonjour${commercial?.firstName ? ` ${escapeHtml(commercial.firstName)}` : ''},</p>
                            <p>L'Analyse du Besoin <strong>${escapeHtml(abId)}</strong> pour <strong>${escapeHtml(companyName)}</strong> vient d'être <strong>signée</strong> par l'entreprise.</p>
                            <p style="margin: 16px 0 8px 0;"><strong>Entreprise :</strong> ${escapeHtml(companyName)} — SIRET ${escapeHtml(String(siret))} — secteur ${escapeHtml(String(sectorLabel))}</p>
                            <p style="margin: 8px 0;"><strong>Poste(s) :</strong> ${positionsList}</p>
                            <p style="margin: 8px 0;"><strong>Réf. AB :</strong> ${escapeHtml(abId)} · <strong>Statut :</strong> SIGNE</p>
                            <p style="margin: 16px 0 8px 0;"><strong>Document signé joint :</strong> ${escapeHtml(filename)} — Analyse du Besoin</p>
                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #555;">Le PDF signé est joint à cet e-mail.</p>
                            <br />
                            <p style="margin-bottom: 0;">Cordialement,</p>
                            <p style="margin-top: 4px; font-weight: bold; color: #0052cc;">L'équipe Disciplina (envoi automatique)</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #f0f0f0;">
                            Copie commerciale — AB ${escapeHtml(abId)} — ${escapeHtml(companyName)} — 1 pièce jointe.
                        </div>
                    </div>
                    ${signatureHtml}
                `;
                    const commercialText = [
                        `Bonjour${commercial?.firstName ? ` ${commercial.firstName}` : ''},`,
                        ``,
                        `L'Analyse du Besoin ${abId} pour ${companyName} vient d'être signée.`,
                        `Entreprise : ${companyName} — SIRET ${siret} — secteur ${sectorLabel}`,
                        `Poste(s) : ${(analysis.positions ?? []).map((p) => p.title || 'Poste').join(', ') || '—'}`,
                        `Réf. AB : ${abId} — Statut : SIGNE`,
                        `Document joint : ${filename}`,
                        ``,
                        `Cordialement, L'équipe Disciplina`,
                    ].join('\n');

                    try {
                        logger.info(`Sending commercial copy from ${senderForCommercial.email} to ${commercialEmail}...`);
                        await gmailService.sendEmail(
                            { access_token: senderForCommercial.oauthToken!, refresh_token: senderForCommercial.refreshToken ?? undefined },
                            withNoReply({ to: commercialEmail, subject: commercialSubject, html: commercialHtml, text: commercialText, attachments }),
                            persist(senderForCommercial.id),
                        );
                        logger.info('Commercial copy email sent successfully!');
                    } catch (err: any) {
                        logger.error({ err }, 'Failed to send commercial copy email via Yousign flow');
                    }

                    // Notify company referent as second mail (if distinct)
                    const referentEmail = analysis.referents?.recruitmentReferents?.email?.trim() || null;
                    if (referentEmail && referentEmail !== commercialEmail) {
                        try {
                            const sigHtml2 = signatureHtml;
                            const companySubject = `[Disciplina] Fiche Analyse du Besoin Signée - ${companyName}`;
                            const companyText = `Bonjour,\n\nL'Analyse du Besoin pour ${companyName} a été signée avec succès.\nVous trouverez le PDF signé en pièce jointe.`;
                            const companyHtml = `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                <div style="background-color: #0052cc; color: white; padding: 24px; text-align: center;">
                                    <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">DISCIPLINA</h2>
                                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Analyse du Besoin en Apprentissage</p>
                                </div>
                                <div style="padding: 24px; background-color: white;">
                                    <p>Bonjour,</p>
                                    <p>Nous avons le plaisir de vous informer que l'Analyse du Besoin en recrutement pour le poste de <strong>${escapeHtml(analysis.positions?.[0]?.title || '—')}</strong> initiée pour <strong>${escapeHtml(companyName)}</strong> a été signée avec succès par les parties prenantes.</p>
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
                            ${sigHtml2}
                        `;
                            await gmailService.sendEmail(
                                { access_token: senderForCommercial.oauthToken!, refresh_token: senderForCommercial.refreshToken ?? undefined },
                                withNoReply({ to: referentEmail, subject: companySubject, html: companyHtml, text: companyText, attachments }),
                                persist(senderForCommercial.id),
                            );
                            logger.info({ to: referentEmail }, 'Company notification email sent successfully (Yousign)');
                        } catch (err: any) {
                            logger.error({ err }, 'Failed to send company notification email via Yousign flow');
                        }
                    }
                }

                // Garde d'idempotence : tout rejeu ultérieur du webhook est ignoré.
                await needsAnalysisRepo.update(analysis.id, { signed_notification_sent_at: new Date() });
            } catch (err) {
                if (processed) throw err;
                logger.error({ err, region: getRegion() }, 'Yousign webhook lookup failed');
            }
        });

        if (!processed) {
            logger.warn({ signatureRequestId }, 'No Needs Analysis found for Yousign Request ID');
            respond(200, { message: 'No matching needs analysis record' });
        } else if (!responded) {
            respond(200, { success: true, message: 'Webhook processed successfully' });
        }
    } catch (error: any) {
        logger.error(error, 'Error processing Yousign Webhook');
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
}
