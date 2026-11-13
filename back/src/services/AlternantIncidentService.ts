import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { UserService } from './UserService';
import { NotificationService } from './NotificationService';
import { JobRole, Permission } from '../types/user.types';
import { Alternant, AlternantIncident } from '../types/alternant.types';
import { logger } from '../external/logger';

/** Délais de suivi d'un accident (#970), donnés par l'issue. */
export const INCIDENT_DECLARATION_REMINDER_HOURS = 48;
export const INCIDENT_ANALYSIS_REMINDER_DAYS = 7;

type NotifyKind = 'declared' | 'declaration_overdue' | 'analysis_overdue';

/**
 * Suivi d'un accident déclaré pour un alternant (#970). Qui doit faire la
 * déclaration (l'employeur si le contrat est actif, sinon le CFA via un P2S +
 * courrier CGSS — contenu hors scope, cf. #967) est choisi à la main par le
 * péda au signalement : il n'existe pas ailleurs dans l'app de notion de
 * « contrat actif » à inférer automatiquement. Rappelle en interne (jamais de
 * mail externe) si la déclaration (délai légal 48h) ou l'analyse des causes
 * (délai 1 semaine) n'est toujours pas cochée faite à l'échéance, tant que ce
 * n'est pas fait — pas d'escalade au-delà, contrairement à #961 point 6.
 */
export class AlternantIncidentService {
    constructor(
        private readonly alternants = new AlternantRepository(),
        private readonly users = new UserService(),
        private readonly notifications = new NotificationService(),
    ) {}

    async report(
        alternantId: string,
        description: string,
        occurredAt: Date,
        declaredByCfa: boolean,
    ): Promise<AlternantIncident> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw new Error('Alternant introuvable');

        const incident: AlternantIncident = {
            description,
            occurred_at: occurredAt,
            declared_at: new Date(),
            declared_by_cfa: declaredByCfa,
            declaration_done_at: null,
            declaration_reminder_sent_at: null,
            analysis_done_at: null,
            analysis_reminder_sent_at: null,
            prevention_measures: null,
        };
        await this.alternants.declareIncident(alternantId, incident);
        await this.notifyResponsable(alternant, incident, 'declared');
        return incident;
    }

    /** Coche la déclaration (employeur ou CFA) comme faite, sur le dernier accident déclaré. */
    async markDeclarationDone(alternantId: string): Promise<boolean> {
        const index = await this.lastIncidentIndex(alternantId);
        if (index === null) return false;
        await this.alternants.markIncidentDeclarationDone(alternantId, index, new Date());
        return true;
    }

    /** Coche l'analyse des causes + mesures de prévention comme faite, sur le dernier accident déclaré. */
    async markAnalysisDone(alternantId: string, preventionMeasures: string | null): Promise<boolean> {
        const index = await this.lastIncidentIndex(alternantId);
        if (index === null) return false;
        await this.alternants.markIncidentAnalysisDone(alternantId, index, new Date(), preventionMeasures);
        return true;
    }

    private async lastIncidentIndex(alternantId: string): Promise<number | null> {
        const alternant = await this.alternants.findById(alternantId);
        const incidents = alternant?.incidents ?? [];
        return incidents.length === 0 ? null : incidents.length - 1;
    }

    /** Tick planificateur : rappel interne si déclaration ou analyse en retard sur un incident non traité. */
    async run(now: Date = new Date()): Promise<{ declarationReminders: number; analysisReminders: number }> {
        const declarationCutoff = new Date(now.getTime() - INCIDENT_DECLARATION_REMINDER_HOURS * 60 * 60 * 1000);
        const analysisCutoff = new Date(now.getTime() - INCIDENT_ANALYSIS_REMINDER_DAYS * 24 * 60 * 60 * 1000);

        let declarationReminders = 0;
        for (const alternant of await this.alternants.findIncidentDeclarationReminderCandidates(declarationCutoff)) {
            for (const [index, incident] of (alternant.incidents ?? []).entries()) {
                if (incident.declaration_done_at || incident.declaration_reminder_sent_at) continue;
                if (new Date(incident.declared_at) > declarationCutoff) continue;
                try {
                    await this.notifyResponsable(alternant, incident, 'declaration_overdue');
                    await this.alternants.markIncidentDeclarationReminderSent(alternant._id, index, now);
                    declarationReminders += 1;
                } catch (err) {
                    logger.error({ err, alternantId: alternant._id }, 'incident: échec rappel déclaration');
                }
            }
        }

        let analysisReminders = 0;
        for (const alternant of await this.alternants.findIncidentAnalysisReminderCandidates(analysisCutoff)) {
            for (const [index, incident] of (alternant.incidents ?? []).entries()) {
                if (incident.analysis_done_at || incident.analysis_reminder_sent_at) continue;
                if (new Date(incident.declared_at) > analysisCutoff) continue;
                try {
                    await this.notifyResponsable(alternant, incident, 'analysis_overdue');
                    await this.alternants.markIncidentAnalysisReminderSent(alternant._id, index, now);
                    analysisReminders += 1;
                } catch (err) {
                    logger.error({ err, alternantId: alternant._id }, 'incident: échec rappel analyse');
                }
            }
        }

        return { declarationReminders, analysisReminders };
    }

    private async notifyResponsable(
        alternant: Alternant,
        incident: AlternantIncident,
        kind: NotifyKind,
    ): Promise<void> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        const responsables = pedas.filter((u) => u.permission === Permission.RESPONSABLE);
        const alternantName = `${alternant.first_name} ${alternant.last_name}`.trim();
        const who = incident.declared_by_cfa ? 'le CFA (P2S + courrier CGSS)' : "l'employeur";

        const content: Record<NotifyKind, { title: string; message: string; level: 'warning' | 'error' }> = {
            declared: {
                title: `Accident déclaré : ${alternantName}`,
                message: `Déclaration à faire par ${who} sous 48h. Analyse des causes et mesures de prévention à décider sous 1 semaine.`,
                level: 'warning',
            },
            declaration_overdue: {
                title: `Déclaration d'accident en retard : ${alternantName}`,
                message: `La déclaration (par ${who}) dépasse le délai légal de 48h et n'est toujours pas cochée faite.`,
                level: 'error',
            },
            analysis_overdue: {
                title: `Analyse d'accident en retard : ${alternantName}`,
                message: `L'analyse des causes et les mesures de prévention dépassent le délai d'1 semaine et ne sont toujours pas cochées faites.`,
                level: 'error',
            },
        };
        const { title, message, level } = content[kind];

        await Promise.all(
            responsables.map((u) =>
                this.notifications.create({
                    userId: u.id,
                    type: `incident_${kind}`,
                    category: 'peda',
                    level,
                    title,
                    message,
                    link: `/peda/alternants/${alternant._id}`,
                }),
            ),
        );
    }
}
