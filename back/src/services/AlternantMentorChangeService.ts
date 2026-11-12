import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { UserService } from './UserService';
import { NotificationService } from './NotificationService';
import { JobRole, Permission } from '../types/user.types';
import { Alternant, AlternantMentorChange } from '../types/alternant.types';

/**
 * Changement de maître d'apprentissage en cours de contrat, déclaré
 * explicitement par un péda (#961 — point 5). Applique le nouveau mentor sur
 * la fiche entreprise, garde un historique, et notifie un péda Responsable
 * pour vérifier les conditions à la main. L'avenant et la déclaration OPCO
 * restent des démarches manuelles (pas de template/process automatisable
 * aujourd'hui) — simplement cochées une fois faites, pour ne pas les oublier.
 */
export class AlternantMentorChangeService {
    constructor(
        private readonly alternants = new AlternantRepository(),
        private readonly users = new UserService(),
        private readonly notifications = new NotificationService(),
    ) {}

    async declare(
        alternantId: string,
        newMentorName: string | null,
        newMentorEmail: string | null,
    ): Promise<AlternantMentorChange> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw new Error('Alternant introuvable');
        if (!alternant.company) throw new Error("Cet alternant n'a pas d'entreprise");

        const change: AlternantMentorChange = {
            previous_mentor_name: alternant.company.mentor_name ?? null,
            previous_mentor_email: alternant.company.mentor_email ?? null,
            new_mentor_name: newMentorName,
            new_mentor_email: newMentorEmail,
            declared_at: new Date(),
            avenant_signed_at: null,
            opco_declared_at: null,
        };

        await this.alternants.setCompany(alternantId, {
            ...alternant.company,
            mentor_name: newMentorName,
            mentor_email: newMentorEmail,
        });
        await this.alternants.declareMentorChange(alternantId, change);
        await this.notifyResponsable(alternant, change);
        return change;
    }

    /** Coche l'avenant comme signé sur le dernier changement déclaré. */
    async markAvenantSigned(alternantId: string): Promise<boolean> {
        return this.markStep(alternantId, 'avenant_signed_at');
    }

    /** Coche la déclaration OPCO comme faite sur le dernier changement déclaré. */
    async markOpcoDeclared(alternantId: string): Promise<boolean> {
        return this.markStep(alternantId, 'opco_declared_at');
    }

    private async markStep(alternantId: string, field: 'avenant_signed_at' | 'opco_declared_at'): Promise<boolean> {
        const alternant = await this.alternants.findById(alternantId);
        const changes = alternant?.mentor_changes ?? [];
        if (changes.length === 0) return false;
        await this.alternants.markMentorChangeStep(alternantId, changes.length - 1, field, new Date());
        return true;
    }

    private async notifyResponsable(alternant: Alternant, change: AlternantMentorChange): Promise<void> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        const responsables = pedas.filter((u) => u.permission === Permission.RESPONSABLE);
        const alternantName = `${alternant.first_name} ${alternant.last_name}`.trim();
        const companyName = alternant.company?.name?.trim() || 'Entreprise inconnue';
        await Promise.all(
            responsables.map((u) =>
                this.notifications.create({
                    userId: u.id,
                    type: 'mentor_change_declared',
                    category: 'peda',
                    level: 'warning',
                    title: `Changement de mentor : ${alternantName}`,
                    message: `${companyName} — nouveau mentor ${change.new_mentor_name ?? '—'}. Vérifier les conditions, préparer l'avenant et la déclaration OPCO.`,
                    link: `/peda/alternants/${alternant._id}`,
                }),
            ),
        );
    }
}
