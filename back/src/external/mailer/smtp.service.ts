import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface SystemMail {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Envoi d'emails « système » (sans contexte utilisateur), via SMTP.
 * Utilisé pour les mails d'authentification (code 2FA) : au login, l'utilisateur
 * n'est pas encore connecté, on ne peut donc pas passer par son Gmail OAuth.
 *
 * Config attendue (Brevo) : SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587,
 * SMTP_SECURE=false, SMTP_USER/SMTP_PASS = identifiants SMTP Brevo,
 * SMTP_FROM = adresse expéditrice vérifiée (au minimum l'email du compte Brevo).
 */
export class SmtpMailerService {
    private transporter: Transporter | null = null;

    private getTransporter(): Transporter {
        if (this.transporter) return this.transporter;
        if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
            throw new Error('SMTP non configuré (SMTP_HOST / SMTP_USER / SMTP_PASS manquants)');
        }
        this.transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE === 'true', // 465 = true (SSL), 587 = false (STARTTLS)
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
        return this.transporter;
    }

    async sendMail(mail: SystemMail): Promise<void> {
        const from = env.SMTP_FROM || env.SMTP_USER!;
        try {
            await this.getTransporter().sendMail({
                from,
                to: mail.to,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
            });
        } catch (err) {
            logger.error({ err, to: mail.to }, '[smtp] envoi email système échoué');
            throw err;
        }
    }
}

export const smtpMailer = new SmtpMailerService();
