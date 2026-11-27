import { logger } from '../logger';
import { GoogleGmailService } from './gmail.service';
import { isInvalidGrant } from './oauth-client';
import { UserService } from '../../services/UserService';
import { JobRole, User } from '../../types/user.types';
import { env } from '../../config/env';
import type { SendEmailOptions } from './types';

const gmailService = new GoogleGmailService();
const userService = new UserService();

/**
 * Repli quand la boîte système n'est pas utilisable : responsables/admin
 * d'abord (comptes stables), puis RH, gestion et commerciaux.
 */
const FALLBACK_ROLES = [JobRole.AD, JobRole.RH, JobRole.GESTION, JobRole.COMMERCIAL];

type Sender = User & { oauthToken: string };

function isUsableSender(user: User | null): user is Sender {
    return Boolean(user?.oauthToken);
}

async function trySend(sender: Sender, options: SendEmailOptions): Promise<boolean> {
    try {
        await gmailService.sendEmail(
            { access_token: sender.oauthToken, refresh_token: sender.refreshToken ?? undefined },
            options,
            userService.googleTokenPersister(sender.id),
        );
        logger.info({ to: options.to, subject: options.subject, senderId: sender.id }, '[SystemMail] Email sent');
        return true;
    } catch (err) {
        logger.error(
            { err, to: options.to, subject: options.subject, senderId: sender.id, invalidGrant: isInvalidGrant(err) },
            '[SystemMail] Failed to send email',
        );
        return false;
    }
}

/**
 * Premier compte du staff réellement connecté, hors comptes déjà tentés.
 */
async function resolveFallback(excludeIds: Set<number>): Promise<Sender | null> {
    const staff = (await userService.findByJobRoles(FALLBACK_ROLES)).filter(
        (user) => isUsableSender(user) && !excludeIds.has(user.id),
    );
    // `findByJobRoles` renvoie les users sans ordre garanti : on respecte
    // l'ordre de FALLBACK_ROLES (responsables d'abord) puis l'id.
    const rank = (user: User) => {
        const index = FALLBACK_ROLES.indexOf(user.role);
        return index === -1 ? FALLBACK_ROLES.length : index;
    };
    staff.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
    // Un access_token seul peut être expiré hors session : on préfère un compte
    // rafraîchissable, comme `UserService.findFirstGoogleConnectedUser`.
    const fallback = staff.find((user) => user.refreshToken) ?? staff[0];
    return isUsableSender(fallback) ? fallback : null;
}

/**
 * Envoie un mail depuis la boîte système du tenant courant.
 *
 * La boîte configurée (`SYSTEM_MAIL_SENDER`) est un point de défaillance
 * silencieux : compte absent de la base du tenant, supprimé, ou jeton révoqué
 * (le client OAuth purge alors les jetons en base). Sans elle, les mails
 * internes — dont « Nouvelle Analyse du Besoin » aux RH — disparaissaient
 * sans bruit alors que la notification in-app continuait. On bascule donc sur
 * un compte du staff connecté, et on loggue en `error` quand plus rien ne part.
 *
 * Best-effort : ne jette jamais (l'appelant enchaîne notification + todo).
 */
export async function sendSystemEmail(options: SendEmailOptions): Promise<void> {
    const triedIds = new Set<number>();

    const configured = await userService.findByEmail(env.SYSTEM_MAIL_SENDER);
    if (isUsableSender(configured) && (await trySend(configured, options))) return;
    if (configured) triedIds.add(configured.id);
    if (!isUsableSender(configured)) {
        logger.warn(
            { email: env.SYSTEM_MAIL_SENDER, found: Boolean(configured) },
            `[SystemMail] Boîte système ${env.SYSTEM_MAIL_SENDER} indisponible (compte absent, supprimé ou Google non connecté) — repli sur un compte du staff`,
        );
    }

    const fallback = await resolveFallback(triedIds);
    if (fallback && (await trySend(fallback, options))) {
        logger.warn(
            { to: options.to, subject: options.subject, fallbackSenderId: fallback.id },
            `[SystemMail] Mail envoyé depuis un compte du staff : reconnecter ${env.SYSTEM_MAIL_SENDER}`,
        );
        return;
    }

    logger.error(
        { to: options.to, subject: options.subject, systemMailbox: env.SYSTEM_MAIL_SENDER },
        `[SystemMail] Aucun expéditeur disponible pour les mails système — mail perdu. Reconnecter ${env.SYSTEM_MAIL_SENDER} (ou n'importe quel compte du staff) dans l'application.`,
    );
}
