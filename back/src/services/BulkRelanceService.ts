import { logger } from '../external/logger';
import { GoogleGmailService } from '../external/google/gmail.service';
import { UserService } from './UserService';
import { CompaniesService } from './CompaniesService';
import { MailTemplateService } from './MailTemplateService';
import { RelanceHistoryRepository } from '../repositories/mysql/RelanceHistoryRepository';
import { NotificationService } from './NotificationService';
import type { Companies } from '../types/company.types';

export interface StartCompanyBulkOptions {
    templateId: string;
    ids?: number[];
    all?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function htmlToText(html: string): string {
    return html
        .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export class BulkRelanceService {
    private gmailService = new GoogleGmailService();
    private userService = new UserService();
    private companiesService = new CompaniesService();
    private mailTemplateService = new MailTemplateService();
    private relanceHistoryRepo = new RelanceHistoryRepository();
    private notificationService = new NotificationService();

    async startCompanyBulk(userId: number, options: StartCompanyBulkOptions): Promise<void> {
        try {
            const user = await this.userService.findById(userId);
            if (!user?.oauthToken || !user?.refreshToken) {
                throw new Error('Compte Google non connecté. Veuillez connecter votre compte Google.');
            }

            const templates = await this.mailTemplateService.list(userId, 'commercial');
            const template = templates.find((t) => t.id === options.templateId);
            if (!template) {
                throw new Error('Modèle de mail introuvable.');
            }

            let attachments: { filename: string; contentType: string; content: string }[] | undefined;
            if (template.attachment) {
                try {
                    attachments = [await this.mailTemplateService.resolveAttachment(userId, options.templateId)];
                } catch (err) {
                    logger.error({ err, templateId: options.templateId }, '[bulk-relance] attachment resolve failed');
                }
            }

            const signatureHtml = await this.mailTemplateService.getSignatureHtml(userId, 'commercial').catch(() => '');

            let companies: Companies[];
            let totalRequested: number;

            if (options.all) {
                const allCompanies = await this.companiesService.findAll();
                companies = allCompanies.filter((c) => !!c.email);
                totalRequested = allCompanies.length;
            } else if (options.ids && options.ids.length > 0) {
                companies = (await Promise.all(options.ids.map((id) => this.companiesService.findById(id)))).filter(
                    (c): c is Companies => c !== null && !!c.email,
                );
                totalRequested = options.ids.length;
            } else {
                throw new Error('Aucune entreprise sélectionnée.');
            }

            if (companies.length === 0) {
                throw new Error('Aucune entreprise valide avec une adresse email.');
            }

            await this.processBulk(userId, companies, template, attachments, signatureHtml, totalRequested);
        } catch (err: any) {
            logger.error({ err, userId }, '[bulk-relance] failed');
            await this.notificationService.create({
                userId,
                type: 'bulk_relance_error',
                category: 'company',
                level: 'error',
                title: 'Relance groupée impossible',
                message: err.message,
            });
        }
    }

    private async processBulk(
        userId: number,
        companies: Companies[],
        template: { subject: string; body: string },
        attachments: { filename: string; contentType: string; content: string }[] | undefined,
        signatureHtml: string,
        totalRequested: number,
    ): Promise<void> {
        let sent = 0;
        let errors = 0;

        const bodyText = htmlToText(template.body);

        for (const company of companies) {
            try {
                const user = await this.userService.findById(userId);
                if (!user?.oauthToken) {
                    errors++;
                    continue;
                }

                await this.gmailService.sendEmail(
                    { access_token: user.oauthToken, refresh_token: user.refreshToken },
                    {
                        to: company.email!,
                        subject: template.subject,
                        html: `${template.body}${signatureHtml}`,
                        text: bodyText,
                        attachments,
                    },
                    this.userService.googleTokenPersister(user.id),
                );

                await this.relanceHistoryRepo.create({
                    companyID: company.id,
                    userID: userId,
                    typeRelance: company.relanceType ?? null,
                    channel: 'MAIL',
                    subject: template.subject,
                });

                await this.companiesService.clearRelance(company.id);

                sent++;
            } catch (err) {
                logger.error({ err, companyId: company.id }, '[bulk-relance] send failed');
                errors++;
            }

            if (sent + errors < companies.length) {
                await sleep(1500);
            }
        }

        const level = errors === 0 ? 'success' : errors === totalRequested ? 'error' : 'warning';
        await this.notificationService.create({
            userId,
            type: 'bulk_relance_completed',
            category: 'company',
            level,
            title: 'Relance groupée terminée',
            message: `${sent}/${totalRequested} mail${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''} avec succès${
                errors > 0 ? ` (${errors} erreur${errors > 1 ? 's' : ''})` : ''
            }`,
        });
    }
}
