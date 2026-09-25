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
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Nom du fichier archivé / joint pour un document signé DocuSeal.
 * DocuSeal renvoie les noms d'origine : 'Mandat de publication',
 * 'Catalogue Disciplina', ou le nom de l'AB générée. Le test précédent ne
 * distinguait que mandat vs reste, ce qui renommait le Catalogue en
 * `Analyse_Besoin_..._Signee.pdf` — on distingue désormais les trois cas.
 *
 * Le suffixe `abId` (8 premiers caractères) distingue les AB d'une même
 * entreprise (une société peut avoir plusieurs AB) tout en restant stable pour
 * une AB donnée — un rejeu du webhook produit exactement les mêmes noms, ce qui
 * permet à l'archivage Drive de dédupliquer au lieu d'empiler des doublons.
 */
function signedAbFilename(docName: string, safeName: string, abId: string): string {
    const shortId = abId.slice(0, 8);
    if (/mandat/i.test(docName)) return `Mandat_Publication_${safeName}_${shortId}_Signe.pdf`;
    if (/catalogue/i.test(docName)) return `Catalogue_Disciplina_${safeName}_${shortId}_Signe.pdf`;
    return `Analyse_Besoin_${safeName}_${shortId}_Signee.pdf`;
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
            logger.info(
                { fallbackUserId: preferred.id, fallbackEmail: preferred.email },
                '[SignedAb] Using Responsable Commercial as mail sender',
            );
            return preferred;
        }
    } catch (err) {
        logger.warn({ err }, '[SignedAb] Failed to resolve Responsable Commercial sender');
    }

    const fallback = await userService.findFirstGoogleConnectedUser([JobRole.COMMERCIAL]);
    if (fallback) {
        logger.info(
            { fallbackUserId: fallback.id, fallbackEmail: fallback.email },
            '[SignedAb] Using fallback Commercial as mail sender',
        );
        return fallback;
    }
    return null;
}

/**
 * Garde anti-concurrence inter-livraisons : DocuSeal peut livrer le même
 * `submission.completed` deux fois en parallèle (retry + livraison initiale).
 * Le second appel attend la fin du premier puis relit la garde d'idempotence
 * (`signed_notification_sent_at`) au lieu d'envoyer les mails en double.
 */
const inflightSubmissions = new Set<string>();

async function waitForInflight(submissionId: string, timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    while (inflightSubmissions.has(submissionId) && Date.now() - start < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
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
 * Idempotence : DocuSeal livre en « au moins une fois » (retries, double-clic
 * de test). La réservation atomique (`claimSignedNotification`) posée AVANT
 * tout I/O lent garantit qu'un seul appel envoie les mails, même en cas de
 * livraisons concurrentes ou multi-instances. Un appel dont
 * `signed_notification_sent_at` est déjà renseigné est un rejeu : on ne
 * réécrit ni sur le Drive ni les deux mails de notification.
 *
 * @returns true si une AB correspondante a été trouvée et traitée.
 */
export async function processSignedAb(submissionId: string): Promise<boolean> {
    if (inflightSubmissions.has(submissionId)) {
        logger.info({ submissionId }, '[SignedAb] Concurrent webhook delivery, waiting for in-flight processing');
        await waitForInflight(submissionId);
    }
    inflightSubmissions.add(submissionId);
    try {
        return await processSignedAbOnce(submissionId);
    } finally {
        inflightSubmissions.delete(submissionId);
    }
}

async function processSignedAbOnce(submissionId: string): Promise<boolean> {
    let handled = false;
    await runForAllRegions(async () => {
        if (handled) return;
        // Réservation posée par CET appel (pour la libérer si on échoue avant
        // tout envoi de mail). Après le premier mail, on la conserve même en
        // cas d'échec partiel : on ne renvoie jamais une copie déjà partie.
        let claimedAbId: string | null = null;
        let mailsAttempted = false;
        try {
            const abDoc = await needsAnalysisRepo.findBySignatureRequestId(submissionId);
            if (!abDoc) return;
            handled = true;
            const region = getRegion();

            // Rejeu du webhook (retry DocuSeal, double livraison) : le premier
            // passage a déjà archivé sur le Drive et envoyé les deux mails.
            if (abDoc.signed_notification_sent_at) {
                logger.info(
                    { region, analysisId: abDoc._id },
                    '[SignedAb] Duplicate webhook ignored, notifications already sent',
                );
                return;
            }
            // AB déjà SIGNE sans trace de traitement automatisé : signature
            // manuelle (`markSigned`) ou archive antérieure à la garde
            // d'idempotence. On ne renvoie ni mails ni doublons Drive.
            if (abDoc.status === NeedsAnalysisStatus.SIGNE && !abDoc.signed_at) {
                logger.info(
                    { region, analysisId: abDoc._id },
                    '[SignedAb] Webhook ignored, AB already signed outside the automated flow',
                );
                return;
            }

            const analysis = toNeedsAnalysis(abDoc);

            // Réservation atomique AVANT tout I/O lent (téléchargement des PDF,
            // Gmail, Drive) : un rejeu livré pendant l'envoi des mails — ou en
            // parallèle depuis une autre instance — perd ici au lieu de
            // renvoyer les mails. Le test lecture-puis-écriture ci-dessus ne
            // suffit pas contre les livraisons concurrentes.
            const claimed = await needsAnalysisRepo.claimSignedNotification(analysis.id);
            if (!claimed) {
                logger.info(
                    { region, analysisId: analysis.id },
                    '[SignedAb] Duplicate webhook ignored, notifications already claimed',
                );
                return;
            }
            claimedAbId = analysis.id;

            await needsAnalysisRepo.update(analysis.id, {
                status: NeedsAnalysisStatus.SIGNE,
                signed_at: new Date(),
            });
            logger.info({ region, analysisId: analysis.id }, 'Needs Analysis status updated to SIGNE');

            const signedDocuments = await docusealService.downloadSignedDocuments(submissionId);
            if (signedDocuments.length === 0) {
                logger.error({ region }, `Could not download signed PDFs for submission ${submissionId}`);
                // Échec avant tout envoi : on libère la réservation pour que le
                // prochain rejeu réessaie (sans spammer : aucun mail n'est parti).
                await needsAnalysisRepo.releaseSignedNotification(analysis.id);
                claimedAbId = null;
                return;
            }

            // Notification temps réel in-app au commercial.
            notifyUser(analysis.salerInfo?.id ?? 0, {
                type: 'ab_signed',
                abId: analysis.id,
                jobTitle: analysis.positions?.[0]?.title,
                companyId: analysis.companyInfos?.id,
            });

            const commercial = analysis.salerInfo?.id ? await userService.findById(analysis.salerInfo.id) : null;
            const company = analysis.companyInfos?.id
                ? await companiesService.findById(analysis.companyInfos.id)
                : null;
            const companyName = company?.name || analysis.companyInfos?.name || 'Entreprise';

            // Notification in-app aux commerciaux du secteur de l'AB (tous, pas seulement
            // le créateur). Best-effort : un échec ne doit pas bloquer l'envoi de l'email.
            try {
                const sector = sectorFromRegion(analysis.companyInfos?.sector);
                if (sector) {
                    const commercials = await userService.findByJobRole(JobRole.COMMERCIAL);
                    const recipients = commercials.filter(
                        (user) => !user.sectors?.length || user.sectors.includes(sector),
                    );
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
                const fname = signedAbFilename(signedDoc.name, safeName, analysis.id);
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
                const filename = signedAbFilename(doc.name, safeCompanyName, analysis.id);
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
                logger.warn(
                    '[SignedAb] No Google OAuth account available to dispatch the commercial copy. Status is still SIGNE.',
                );
            } else {
                const signatureHtml = await mailTemplateService
                    .getSignatureHtml(senderForCommercial.id, 'commercial')
                    .catch(() => '');
                const positionsList =
                    (analysis.positions ?? [])
                        .map((p) => `${escapeHtml(p.title || 'Poste')} ${p.count ? `(x${p.count})` : ''}`.trim())
                        .filter(Boolean)
                        .join(', ') || '—';
                const siret = (company as any)?.siret || analysis.companyInfos?.siret || '—';
                const sectorLabel = analysis.companyInfos?.sector || '—';
                const abId = analysis.id;
                const docsList = attachments
                    .map((a) => `<li>${escapeHtml(a.filename)} — ${signedAbLabel(a.filename)}</li>`)
                    .join('');
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
                    await userService.updateGoogleTokens(
                        uid,
                        refreshed.access_token ?? null,
                        refreshed.refresh_token ?? null,
                    );
                };

                // À partir d'ici un mail peut partir : en cas d'exception on
                // conserve la réservation (anti-spam), même si la seconde copie
                // n'est pas encore partie.
                mailsAttempted = true;
                try {
                    await gmailService.sendEmail(
                        {
                            access_token: senderForCommercial.oauthToken!,
                            refresh_token: senderForCommercial.refreshToken ?? undefined,
                        },
                        withNoReply({
                            to: commercialEmail,
                            subject: commercialSubject,
                            html: commercialHtml,
                            text: commercialText,
                            attachments,
                        }),
                        persistRefreshedTokens(senderForCommercial.id),
                    );
                    logger.info(
                        { region, analysisId: analysis.id, to: commercialEmail, from: senderForCommercial.email },
                        'Commercial copy email sent successfully.',
                    );
                } catch (err) {
                    logger.error({ err, analysisId: analysis.id }, 'Failed to send commercial copy email');
                }

                // ── Notification entreprise (si referent) — best-effort second mail ──
                const referentEmail = analysis.referents?.recruitmentReferents?.email?.trim() || null;
                if (referentEmail && referentEmail !== commercialEmail) {
                    try {
                        const companySubject = `[Disciplina] Fiche Analyse du Besoin Signée - ${companyName}`;
                        const companyText = `Bonjour,\n\nL'Analyse du Besoin pour ${companyName} a été signée avec succès.\nVous trouverez le PDF signé en pièce jointe.`;
                        const companySignatureHtml = await mailTemplateService
                            .getSignatureHtml(senderForCommercial.id, 'commercial')
                            .catch(() => '');
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
                            {
                                access_token: senderForCommercial.oauthToken!,
                                refresh_token: senderForCommercial.refreshToken ?? undefined,
                            },
                            withNoReply({
                                to: referentEmail,
                                subject: companySubject,
                                html: companyHtml,
                                text: companyText,
                                attachments,
                            }),
                            persistRefreshedTokens(senderForCommercial.id),
                        );
                        logger.info(
                            { region, analysisId: analysis.id, to: referentEmail },
                            'Company notification email sent successfully.',
                        );
                    } catch (err) {
                        logger.error({ err, analysisId: analysis.id }, 'Failed to send company notification email');
                    }
                }
            }

            // La réservation atomique posée en tête de traitement tient lieu de
            // garde d'idempotence : tout rejeu ultérieur du webhook pour cette
            // submission est ignoré (pas de doublons Drive ni de mails en double).
            logger.info({ region, analysisId: analysis.id }, '[SignedAb] Signed-AB processing completed');
        } catch (err) {
            if (handled) {
                if (claimedAbId && !mailsAttempted) {
                    // Échec avant tout envoi : on libère la réservation pour que
                    // le prochain rejeu réessaie (aucun mail n'est parti).
                    await needsAnalysisRepo.releaseSignedNotification(claimedAbId).catch((releaseErr) => {
                        logger.warn(
                            { err: releaseErr, analysisId: claimedAbId },
                            '[SignedAb] Failed to release signed-notification claim',
                        );
                    });
                }
                throw err;
            }
            logger.error({ err, region: getRegion() }, 'Signature lookup failed');
        }
    });
    if (!handled) logger.warn(`No Needs Analysis found for signature submission ID: ${submissionId}`);
    return handled;
}
