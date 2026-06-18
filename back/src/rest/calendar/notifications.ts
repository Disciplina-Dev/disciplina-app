import { GoogleGmailService } from '../../external/google/gmail.service';
import { GoogleTokens } from '../../external/google/types';
import { UserService } from '../../services/UserService';
import { User } from '../../types/user.types';
import { logger } from '../../external/logger';

const gmailService = new GoogleGmailService();
const userService = new UserService();

/** Fuseau par défaut de la plateforme (La Réunion). */
const DEFAULT_TZ = 'Indian/Reunion';

/** Formate un instant pour affichage (ex "lundi 16 juin 2026 à 09:00"). */
function formatInTz(iso: string, tz: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
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
}

/** Envoie un email de confirmation de rendez-vous via le compte Gmail de l'hôte. Ne jette jamais. */
export async function sendRdvConfirmation({ host, to, title, startIso, location, tz = DEFAULT_TZ }: ConfirmationParams): Promise<void> {
    const when = formatInTz(startIso, tz);
    const subject = `Confirmation de votre rendez-vous — ${title}`;
    const lieu = location ? `<p><strong>Lieu :</strong> ${location}</p>` : '';
    const html = `
        <p>Bonjour,</p>
        <p>Votre rendez-vous « <strong>${title}</strong> » avec ${host.name} est confirmé.</p>
        <p><strong>Date :</strong> ${when}</p>
        ${lieu}
        <p>À bientôt,<br/>${host.name}</p>`;
    const text = `Bonjour,\n\nVotre rendez-vous « ${title} » avec ${host.name} est confirmé.\n`
        + `Date : ${when}\n${location ? `Lieu : ${location}\n` : ''}\nÀ bientôt,\n${host.name}`;

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
}

/** Envoie un email de relance « vous n'êtes pas venu » avec le lien de réservation. Ne jette jamais. */
export async function sendNoShowRebooking({ host, to, title, bookingUrl }: RebookingParams): Promise<void> {
    const subject = `Vous avez manqué votre rendez-vous — ${title}`;
    const html = `
        <p>Bonjour,</p>
        <p>Nous ne vous avons pas vu à votre rendez-vous « <strong>${title}</strong> » avec ${host.name}.</p>
        <p>Si vous le souhaitez, vous pouvez reprendre un créneau qui vous convient :</p>
        <p><a href="${bookingUrl}">Reprendre un rendez-vous</a></p>
        <p>À bientôt,<br/>${host.name}</p>`;
    const text = `Bonjour,\n\nNous ne vous avons pas vu à votre rendez-vous « ${title} » avec ${host.name}.\n`
        + `Si vous le souhaitez, reprenez un créneau ici : ${bookingUrl}\n\nÀ bientôt,\n${host.name}`;

    try {
        await gmailService.sendEmail(tokensFor(host), { to, subject, html, text }, onRefresh(host.id));
    } catch (err) {
        logger.error({ err }, 'No-show rebooking email failed');
    }
}
