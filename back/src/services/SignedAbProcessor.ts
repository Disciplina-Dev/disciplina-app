import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { toNeedsAnalysis } from './mappers/needsAnalysis.mapper';
import { NeedsAnalysisStatus } from '../types/needsAnalysisNoSql.types';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { UserService } from './UserService';
import { NotificationService } from './NotificationService';
import { CompaniesService } from './CompaniesService';
import { DocuSealService } from '../external/docuseal/docuseal.service';
import { abDriveConfigService } from './AbDriveConfigService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { MailTemplateService } from './MailTemplateService';
import { sectorFromRegion } from '../utils/sector';
import { JobRole } from '../types/user.types';
import { logger } from '../external/logger';

import { notifyUser } from '../rest/yousign/sse';

const needsAnalysisRepo = new NeedsAnalysisRepository();
const userRepo = new UserRepository();
const userService = new UserService();
const notificationService = new NotificationService();
const companiesService = new CompaniesService();
const docusealService = new DocuSealService();
const gmailService = new GoogleGmailService();
const mailTemplateService = new MailTemplateService();

/** Slug front d'une fiche entreprise (`/commercial/portefeuille/<slug>`), miroir de toSlug côté front. */
function companySlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Traitement commun quand une Analyse du Besoin est signée :
 * met à jour le statut, notifie le commercial en temps réel (SSE) et envoie le
 * PDF signé par email. Indépendant du fournisseur de signature.
 *
 * @returns true si une AB correspondante a été trouvée et traitée.
 */
export async function processSignedAb(submissionId: string): Promise<boolean> {
    const abDoc = await needsAnalysisRepo.findBySignatureRequestId(submissionId);
    if (!abDoc) {
        logger.warn(`No Needs Analysis found for signature submission ID: ${submissionId}`);
        return false;
    }
    const analysis = toNeedsAnalysis(abDoc);

    await needsAnalysisRepo.update(analysis.id, { status: NeedsAnalysisStatus.SIGNE });
    logger.info(`Needs Analysis ID ${analysis.id} status updated to SIGNE`);

    // Notification temps réel in-app au commercial.
    notifyUser(analysis.salerInfo?.id ?? 0, {
        type: 'ab_signed',
        abId: analysis.id,
        jobTitle: analysis.positions?.[0]?.title,
        companyId: analysis.companyInfos?.id,
    });

    const signedDocuments = await docusealService.downloadSignedDocuments(submissionId);
    if (signedDocuments.length === 0) {
        logger.error(`Could not download signed PDFs for submission ${submissionId}`);
        return true;
    }

    const commercial = analysis.salerInfo?.id ? await userRepo.findById(analysis.salerInfo.id) : null;
    const company = analysis.companyInfos?.id ? await companiesService.findById(analysis.companyInfos.id) : null;
    const companyName = company?.name || 'Entreprise';

    // Notification in-app aux commerciaux du secteur de l'AB (tous, pas seulement
    // le créateur). Best-effort : un échec ne doit pas bloquer l'envoi de l'email.
    try {
        const sector = sectorFromRegion(analysis.companyInfos?.sector);
        if (sector) {
            const commercials = await userService.findByJobRole(JobRole.COMMERCIAL);
            const recipients = commercials.filter((user) => !user.sectors?.length || user.sectors.includes(sector));
            if (recipients.length > 0) {
                await Promise.all(
                    recipients.map((recipient) =>
                        notificationService.create({
                            userId: recipient.id,
                            type: 'ab_signed',
                            category: 'company',
                            level: 'success',
                            title: 'AB signée',
                            message: `L'analyse du besoin pour ${companyName}${
                                analysis.positions?.[0]?.title ? ` (${analysis.positions[0].title})` : ''
                            } a été signée.`,
                            link: `/commercial/portefeuille/${companySlug(companyName)}`,
                        }),
                    ),
                );
            }
        }
    } catch (err) {
        logger.error({ err, abId: analysis.id }, 'Failed to notify sector commercials of signed AB');
    }

    // Archivage Drive du/des PDF signé(s) dans le dossier "signé" du secteur de l'AB
    // (région de l'entreprise), pas celui du commercial.
    // Best-effort : n'empêche pas l'envoi de l'email ci-dessous.
    const safeName = companyName.replace(/\s+/g, '_');
    for (const signedDoc of signedDocuments) {
        const isMandat = /mandat/i.test(signedDoc.name);
        const fname = isMandat ? `Mandat_Publication_${safeName}_Signe.pdf` : `Analyse_Besoin_${safeName}_Signee.pdf`;
        await abDriveConfigService.archiveAbPdf(
            analysis.companyInfos?.sector,
            'SIGNED',
            signedDoc.buffer,
            fname,
            analysis.salerInfo?.id ?? undefined,
        );
    }

    // Trouver un compte avec des credentials Google valides pour envoyer l'email.
    let senderUser: any = commercial;
    if (!senderUser?.oauth_token || !senderUser?.refresh_token) {
        const allUsers = (await userRepo.findByRoleId(1)) || [];
        const fallback = allUsers.find((u: any) => u.oauth_token && u.refresh_token);
        if (fallback) senderUser = fallback;
    }

    if (!senderUser?.oauth_token || !senderUser?.refresh_token) {
        logger.warn('No Google OAuth account available to dispatch the signed PDF email. Status is still SIGNE.');
        return true;
    }

    const safeCompanyName = companyName.replace(/\s+/g, '_');
    const attachments = signedDocuments.map((doc) => {
        const isMandat = /mandat/i.test(doc.name);
        const filename = isMandat
            ? `Mandat_Publication_${safeCompanyName}_Signe.pdf`
            : `Analyse_Besoin_${safeCompanyName}_Signee.pdf`;
        return {
            content: doc.buffer.toString('base64'),
            filename,
            contentType: 'application/pdf',
        };
    });
    const signatureHtml = await mailTemplateService.getSignatureHtml(senderUser.id, 'commercial').catch(() => '');
    const mailOptions = {
        to: `${analysis.referents?.recruitmentReferents?.email || ''}, ${senderUser.email}`,
        subject: `[Disciplina] Fiche Analyse du Besoin Signée - ${companyName}`,
        text: `Bonjour,\n\nL'Analyse du Besoin pour ${companyName} a été signée avec succès.\nVous trouverez le PDF signé en pièce jointe.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #0052cc; color: white; padding: 24px; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">DISCIPLINA</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Analyse du Besoin en Apprentissage</p>
                </div>
                <div style="padding: 24px; background-color: white;">
                    <p>Bonjour,</p>
                    <p>L'Analyse du Besoin en recrutement pour le poste de <strong>${analysis.positions?.[0]?.title}</strong> initiée pour <strong>${companyName}</strong> a été signée avec succès.</p>
                    <p>Le document signé est joint à cet e-mail pour vos archives.</p>
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
        attachments,
    };

    const persistRefreshedTokens = (uid: number) => async (refreshed: any) => {
        await userService.updateGoogleTokens(uid, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
    };

    try {
        await gmailService.sendEmail(
            { access_token: senderUser.oauth_token, refresh_token: senderUser.refresh_token },
            mailOptions,
            persistRefreshedTokens(senderUser.id),
        );
        logger.info('Signed AB notification email sent successfully.');
    } catch (err) {
        logger.error({ err }, 'Failed to send signed AB notification email');
    }

    return true;
}
