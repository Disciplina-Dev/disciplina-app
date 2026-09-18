import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { toNeedsAnalysis } from './mappers/needsAnalysis.mapper';
import { NeedsAnalysisStatus } from '../types/needsAnalysisNoSql.types';
import { UserService } from './UserService';
import { NotificationService } from './NotificationService';
import { CompaniesService } from './CompaniesService';
import { DocuSealService } from '../external/docuseal/docuseal.service';
import { abDriveConfigService } from './AbDriveConfigService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { MailTemplateService } from './MailTemplateService';
import { sectorFromRegion } from '../utils/sector';
import { JobRole, Permission } from '../types/user.types';
import { logger } from '../external/logger';
import { getRegion, runForAllRegions } from '../db/tenant';

import { notifyUser } from '../rest/yousign/sse';

const needsAnalysisRepo = new NeedsAnalysisRepository();
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

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Nom du fichier archivé / joint pour un document signé DocuSeal.
 * DocuSeal renvoie les noms d'origine : 'Mandat de publication',
 * 'Catalogue Disciplina', ou le nom de l'AB générée. Le test précédent ne
 * distinguait que mandat vs reste, ce qui renommait le Catalogue en
 * `Analyse_Besoin_..._Signee.pdf` — on distingue désormais les trois cas.
 */
function signedAbFilename(docName: string, safeName: string): string {
    if (/mandat/i.test(docName)) return `Mandat_Publication_${safeName}_Signe.pdf`;
    if (/catalogue/i.test(docName)) return `Catalogue_Disciplina_${safeName}_Signe.pdf`;
    return `Analyse_Besoin_${safeName}_Signee.pdf`;
}

function signedAbLabel(filename: string): string {
    if (/mandat/i.test(filename)) return 'Mandat de publication';
    if (/catalogue/i.test(filename)) return 'Catalogue Disciplina';
    return 'Analyse du Besoin';
}

/**
 * Résout l'expéditeur pour le mail copie commerciale.
 * Priorité : commercial propriétaire (si Google connecté) → Responsable Commercial connecté → fallback Commercial connecté.
 */
async function resolveCommercialMailSender(commercial: any | null): Promise<any | null> {
    if (commercial?.oauthToken && commercial.refreshToken) return commercial;
    if (commercial?.oauthToken) return commercial;

    // Responsable Commercial = permission RESPONSABLE + job COMMERCIAL
    try {
        const responsables = await userService.findByPermission(Permission.RESPONSABLE);
        const rcWithToken = responsables.filter((u: any) => u.role === JobRole.COMMERCIAL && u.oauthToken);
        const preferred = rcWithToken.find((u: any) => u.refreshToken) ?? rcWithToken[0];
        if (preferred) {
            logger.info({ fallbackUserId: preferred.id, fallbackEmail: preferred.email }, '[SignedAb] Using Responsable Commercial as mail sender');
            return preferred;
        }
    } catch (err) {
        logger.warn({ err }, '[SignedAb] Failed to resolve Responsable Commercial sender');
    }

    const fallback = await userService.findFirstGoogleConnectedUser([JobRole.COMMERCIAL]);
    if (fallback) {
        logger.info({ fallbackUserId: fallback.id, fallbackEmail: fallback.email }, '[SignedAb] Using fallback Commercial as mail sender');
        return fallback;
    }
    return null;
}

/**
 * Traitement commun quand une Analyse du Besoin est signée :
 * met à jour le statut, notifie le commercial en temps réel (SSE) et envoie le
 * PDF signé par email. Indépendant du fournisseur de signature.
 *
 * Le webhook n'a pas de JWT : on itère les deux bases régionales (l'AB n'existe
 * que dans UNE seule), puis on traite dans la région trouvée sous ALS — écritures
 * MySQL/Mongo et push SSE repartent vers la bonne base et la bonne clé de canal.
 *
 * @returns true si une AB correspondante a été trouvée et traitée.
 */
export async function processSignedAb(submissionId: string): Promise<boolean> {
    let handled = false;
    await runForAllRegions(async () => {
        if (handled) return;
        try {
            const abDoc = await needsAnalysisRepo.findBySignatureRequestId(submissionId);
            if (!abDoc) return;
            handled = true;
            const analysis = toNeedsAnalysis(abDoc);
            const region = getRegion();

            await needsAnalysisRepo.update(analysis.id, { status: NeedsAnalysisStatus.SIGNE });
            logger.info({ region, analysisId: analysis.id }, 'Needs Analysis status updated to SIGNE');

            // Notification temps réel in-app au commercial.
            notifyUser(analysis.salerInfo?.id ?? 0, {
                type: 'ab_signed',
                abId: analysis.id,
                jobTitle: analysis.positions?.[0]?.title,
                companyId: analysis.companyInfos?.id,
            });

            const signedDocuments = await docusealService.downloadSignedDocuments(submissionId);
            if (signedDocuments.length === 0) {
                logger.error({ region }, `Could not download signed PDFs for submission ${submissionId}`);
                return;
            }

            const commercial = analysis.salerInfo?.id ? await userService.findById(analysis.salerInfo.id) : null;
            const company = analysis.companyInfos?.id ? await companiesService.findById(analysis.companyInfos.id) : null;
            const companyName = company?.name || analysis.companyInfos?.name || 'Entreprise';

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
            const driveLinks: string[] = [];
            for (const signedDoc of signedDocuments) {
                const fname = signedAbFilename(signedDoc.name, safeName);
                const link = await abDriveConfigService.archiveAbPdf(
                    analysis.companyInfos?.sector,
                    'SIGNED',
                    signedDoc.buffer,
                    fname,
                    companyName,
                    analysis.salerInfo?.id ?? undefined,
                );
                if (link) driveLinks.push(link);
            }

            const safeCompanyName = safeName;
            const attachments = signedDocuments.map((doc) => {
                const filename = signedAbFilename(doc.name, safeCompanyName);
                return {
                    content: doc.buffer.toString('base64'),
                    filename,
                    contentType: 'application/pdf',
                };
            });

            // ── Envoi copie commerciale (prioritaire) ──────────────────────────
            const commercialEmail = commercial?.email?.trim() || null;
            const senderForCommercial = await resolveCommercialMailSender(commercial);

            if (!commercialEmail) {
                logger.warn({ analysisId: analysis.id }, '[SignedAb] No commercial email — skipping commercial copy');
            } else if (!senderForCommercial?.oauthToken) {
                logger.warn('[SignedAb] No Google OAuth account available to dispatch the commercial copy. Status is still SIGNE.');
            } else {
                const signatureHtml = await mailTemplateService.getSignatureHtml(senderForCommercial.id, 'commercial').catch(() => '');
                const positionsList = (analysis.positions ?? [])
                    .map((p) => `${escapeHtml(p.title || 'Poste')} ${p.count ? `(x${p.count})` : ''}`.trim())
                    .filter(Boolean)
                    .join(', ') || '—';
                const siret = (company as any)?.siret || analysis.companyInfos?.siret || '—';
                const sectorLabel = analysis.companyInfos?.sector || '—';
                const abId = analysis.id;
                const docsList = attachments.map((a) => `<li>${escapeHtml(a.filename)} — ${signedAbLabel(a.filename)}</li>`).join('');
                const driveInfo = driveLinks.length
                    ? `<p style="margin:8px 0 0 0;font-size:13px;color:#555;">Archivage Drive secteur <strong>${escapeHtml(sectorLabel)}</strong> : ${driveLinks.map((l) => `<a href="${l}" style="color:#0052cc;">ouvrir le dossier</a>`).join(' · ')}</p>`
                    : `<p style="margin:8px 0 0 0;font-size:13px;color:#555;">Archivage Drive : en attente (dossier secteur ${escapeHtml(sectorLabel)} non configuré ou échec temporaire).</p>`;

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
                            <p style="margin: 16px 0 8px 0;"><strong>Documents signés joints (${attachments.length}) :</strong></p>
                            <ul style="margin: 4px 0 12px 18px; padding: 0;">${docsList}</ul>
                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #555;">Tous les PDFs signés (AB + Mandat) sont joints à cet e-mail.</p>
                            ${driveInfo}
                            <br />
                            <p style="margin-bottom: 0;">Cordialement,</p>
                            <p style="margin-top: 4px; font-weight: bold; color: #0052cc;">L'équipe Disciplina (envoi automatique)</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #f0f0f0;">
                            Copie commerciale — AB ${escapeHtml(abId)} — ${escapeHtml(companyName)} — ${attachments.length} pièce(s) jointe(s).
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
                    `Documents joints (${attachments.length}) : ${attachments.map((a) => a.filename).join(', ')}`,
                    driveLinks.length ? `Drive : ${driveLinks.join(' ')}` : `Drive : archivage en attente`,
                    ``,
                    `Cordialement, L'équipe Disciplina`,
                ].join('\n');

                const persistRefreshedTokens = (uid: number) => async (refreshed: any) => {
                    await userService.updateGoogleTokens(uid, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
                };

                try {
                    await gmailService.sendEmail(
                        { access_token: senderForCommercial.oauthToken!, refresh_token: senderForCommercial.refreshToken ?? undefined },
                        withNoReply({ to: commercialEmail, subject: commercialSubject, html: commercialHtml, text: commercialText, attachments }),
                        persistRefreshedTokens(senderForCommercial.id),
                    );
                    logger.info({ region, analysisId: analysis.id, to: commercialEmail, from: senderForCommercial.email }, 'Commercial copy email sent successfully.');
                } catch (err) {
                    logger.error({ err, analysisId: analysis.id }, 'Failed to send commercial copy email');
                }

                // ── Notification entreprise (si referent) — best-effort second mail ──
                const referentEmail = analysis.referents?.recruitmentReferents?.email?.trim() || null;
                if (referentEmail && referentEmail !== commercialEmail) {
                    try {
                        const companySubject = `[Disciplina] Fiche Analyse du Besoin Signée - ${companyName}`;
                        const companyText = `Bonjour,\n\nL'Analyse du Besoin pour ${companyName} a été signée avec succès.\nVous trouverez le PDF signé en pièce jointe.`;
                        const companySignatureHtml = await mailTemplateService.getSignatureHtml(senderForCommercial.id, 'commercial').catch(() => '');
                        const companyHtml = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #0052cc; color: white; padding: 24px; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">DISCIPLINA</h2>
                            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Analyse du Besoin en Apprentissage</p>
                        </div>
                        <div style="padding: 24px; background-color: white;">
                            <p>Bonjour,</p>
                            <p>L'Analyse du Besoin en recrutement pour le poste de <strong>${escapeHtml(analysis.positions?.[0]?.title || '—')}</strong> initiée pour <strong>${escapeHtml(companyName)}</strong> a été signée avec succès.</p>
                            <p>Le document signé est joint à cet e-mail pour vos archives.</p>
                            <br />
                            <p style="margin-bottom: 0;">Cordialement,</p>
                            <p style="margin-top: 4px; font-weight: bold; color: #0052cc;">L'équipe Relations Entreprises Disciplina</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #f0f0f0;">
                            Ceci est un e-mail automatique envoyé par l'application CRM Disciplina.
                        </div>
                    </div>
                    ${companySignatureHtml}
                `;
                        await gmailService.sendEmail(
                            { access_token: senderForCommercial.oauthToken!, refresh_token: senderForCommercial.refreshToken ?? undefined },
                            withNoReply({ to: referentEmail, subject: companySubject, html: companyHtml, text: companyText, attachments }),
                            persistRefreshedTokens(senderForCommercial.id),
                        );
                        logger.info({ region, analysisId: analysis.id, to: referentEmail }, 'Company notification email sent successfully.');
                    } catch (err) {
                        logger.error({ err, analysisId: analysis.id }, 'Failed to send company notification email');
                    }
                }
            }
        } catch (err) {
            if (handled) throw err;
            logger.error({ err, region: getRegion() }, 'Signature lookup failed');
        }
    });
    if (!handled) logger.warn(`No Needs Analysis found for signature submission ID: ${submissionId}`);
    return handled;
}
