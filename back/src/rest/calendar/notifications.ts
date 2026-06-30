import { GoogleGmailService } from '../../external/google/gmail.service';
import { GoogleTokens } from '../../external/google/types';
import { UserService } from '../../services/UserService';
import { MailTemplateService } from '../../services/MailTemplateService';
import { User } from '../../types/user.types';
import { logger } from '../../external/logger';

const gmailService = new GoogleGmailService();
const userService = new UserService();
const mailTemplateService = new MailTemplateService();

/** Fuseau par défaut de la plateforme (La Réunion). */
const DEFAULT_TZ = 'Indian/Reunion';

/** Formate un instant pour affichage (ex "lundi 16 juin 2026 à 09:00"). */
function formatInTz(iso: string, tz: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** Variables de date détaillées pour les modèles de mail (identiques au flux booking). */
function dateVars(iso: string, tz: string): Record<string, string> {
    const d = new Date(iso);
    return {
        jour: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long' }).format(d),
        date_longue: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(d),
        date_courte: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(d),
        heure: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d),
    };
}

/** Remplace les variables {{cle}} d'un modèle par leurs valeurs (clés inconnues → ""). */
function renderTemplate(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '');
}

function tokensFor(host: User): GoogleTokens {
    return { access_token: host.oauthToken ?? undefined, refresh_token: host.refreshToken ?? undefined };
}

function onRefresh(hostId: number) {
    return (refreshed: GoogleTokens) =>
        userService.updateGoogleTokens(hostId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
}

interface ConfirmationParams {
    host: User;
    to: string;
    title: string;
    startIso: string;
    location?: string;
    tz?: string;
    durationMin?: number;
    /** Modèle de mail choisi par l'hôte (cf. réglages booking). Si présent → personnalisé. */
    confirmationSubject?: string | null;
    confirmationBody?: string | null;
}

/** Envoie un email de confirmation de rendez-vous via le compte Gmail de l'hôte. Ne jette jamais. */
export async function sendRdvConfirmation({
    host,
    to,
    title,
    startIso,
    location,
    tz = DEFAULT_TZ,
    durationMin,
    confirmationSubject,
    confirmationBody,
}: ConfirmationParams): Promise<void> {
    const when = formatInTz(startIso, tz);

    let subject: string;
    let html: string;
    let text: string;

    if (confirmationBody && confirmationBody.trim()) {
        // Modèle personnalisé : mêmes variables que le flux booking. {{nom}} inconnu ici (RDV manuel) → vide.
        const vars: Record<string, string> = {
            nom: '',
            date: `${when} (${tz})`,
            ...dateVars(startIso, tz),
            lieu: location ?? '',
            titre: title,
            duree: durationMin ? `${durationMin} minutes` : '',
            hote: `${host.firstName} ${host.lastName}`.trim(),
        };
        subject = renderTemplate(confirmationSubject || `Confirmation de votre rendez-vous — ${title}`, vars);
        html = renderTemplate(confirmationBody, vars);
        text = html.replace(/<[^>]+>/g, '');
    } else {
        subject = `Confirmation de votre rendez-vous — ${title}`;
        const lieu = location ? `<p><strong>Lieu :</strong> ${location}</p>` : '';
        html = `
        <p>Bonjour,</p>
        <p>Votre rendez-vous « <strong>${title}</strong> » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.</p>
        <p><strong>Date :</strong> ${when}</p>
        ${lieu}
        <p>À bientôt,<br/>${`${host.firstName} ${host.lastName}`.trim()}</p>`;
        text =
            `Bonjour,\n\nVotre rendez-vous « ${title} » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.\n` +
            `Date : ${when}\n${
                location ? `Lieu : ${location}\n` : ''
            }\nÀ bientôt,\n${`${host.firstName} ${host.lastName}`.trim()}`;
    }

    const signatureHtml = await mailTemplateService.getSignatureHtml(host.id, 'rh').catch(() => '');
    if (signatureHtml) html += signatureHtml;

    try {
        await gmailService.sendEmail(tokensFor(host), { to, subject, html, text }, onRefresh(host.id));
    } catch (err) {
        logger.error({ err }, 'RDV confirmation email failed');
    }
}

interface RebookingParams {
    host: User;
    to: string;
    title: string;
    bookingUrl: string;
    /** Modèle de proposition d'entretien choisi par l'hôte (cf. réglages booking). {{lien}} = lien de réservation. */
    propositionSubject?: string | null;
    propositionBody?: string | null;
}

/** Envoie le mail de proposition de rendez-vous (lien de réservation) après un « pas venu ». Ne jette jamais. */
export async function sendNoShowRebooking({
    host,
    to,
    title,
    bookingUrl,
    propositionSubject,
    propositionBody,
}: RebookingParams): Promise<void> {
    const hostName = `${host.firstName} ${host.lastName}`.trim();
    const linkHtml = `<a href="${bookingUrl}">${bookingUrl}</a>`;

    let subject: string;
    let html: string;
    let text: string;

    if (propositionBody && propositionBody.trim()) {
        // Modèle personnalisé : variable {{lien}} = lien de réservation.
        const vars: Record<string, string> = { lien: linkHtml, titre: title, hote: hostName, nom: '' };
        subject = renderTemplate(propositionSubject || `Proposition de rendez-vous — ${title}`, vars);
        html = propositionBody.includes('{{lien}}')
            ? renderTemplate(propositionBody, vars)
            : `${renderTemplate(propositionBody, vars)}<p>${linkHtml}</p>`;
        text = html.replace(/<[^>]+>/g, '');
    } else {
        subject = `Proposition de rendez-vous — ${title}`;
        html = `
        <p>Bonjour,</p>
        <p>Nous ne vous avons pas vu à votre rendez-vous « <strong>${title}</strong> » avec ${hostName}.</p>
        <p>Si vous le souhaitez, vous pouvez reprendre un créneau qui vous convient :</p>
        <p>${linkHtml}</p>
        <p>À bientôt,<br/>${hostName}</p>`;
        text =
            `Bonjour,\n\nNous ne vous avons pas vu à votre rendez-vous « ${title} » avec ${hostName}.\n` +
            `Si vous le souhaitez, reprenez un créneau ici : ${bookingUrl}\n\nÀ bientôt,\n${hostName}`;
    }

    const signatureHtml = await mailTemplateService.getSignatureHtml(host.id, 'rh').catch(() => '');
    const htmlWithSig = signatureHtml ? html + signatureHtml : html;

    try {
        await gmailService.sendEmail(tokensFor(host), { to, subject, html: htmlWithSig, text }, onRefresh(host.id));
    } catch (err) {
        logger.error({ err }, 'No-show rebooking email failed');
    }
}
