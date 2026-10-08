import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../repositories/mongo/AlternantSequenceRepository';
import { RuptureRepository } from '../repositories/mongo/RuptureRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { Alternant } from '../types/alternant.types';
import { UserRowJoined } from '../types/db-rows.types';
import {
    DeclareRuptureInput,
    RUPTURE_MOTIFS,
    Rupture,
    UpdateRuptureInput,
} from '../types/rupture.types';
import { logger } from '../external/logger';

function requireValidDate(iso: string | undefined, field: string): Date {
    if (!iso) throw new Error(`${field} est obligatoire`);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`${field} invalide`);
    return d;
}

function requireMotif(motif: string | undefined): string {
    const trimmed = motif?.trim() ?? '';
    if (!trimmed) throw new Error('Le motif de la rupture est obligatoire');
    if (!(RUPTURE_MOTIFS as readonly string[]).includes(trimmed)) throw new Error('Motif de rupture invalide');
    return trimmed;
}

function requireMonth(year: number | undefined, month: number | undefined): { year: number; month: number } {
    if (!Number.isInteger(year) || (year as number) < 2000 || (year as number) > 2100) {
        throw new Error('Année invalide');
    }
    if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) {
        throw new Error('Mois invalide');
    }
    return { year: year as number, month: month as number };
}

/** Ligne du rapport mensuel : rupture + identité de l'alternant au moment de la lecture. */
export interface RuptureReportRow {
    rupture: Rupture;
    alternant: Alternant | null;
}

export class RuptureService {
    private ruptures = new RuptureRepository();
    private alternants = new AlternantRepository();
    private sequences = new AlternantSequenceRepository();
    private userRepository = new UserRepository();
    private notificationService = new NotificationService();

    /**
     * L'état d'archive suit les ruptures « quitte la formation » :
     * tant qu'il reste au moins une rupture avec `poursuit_formation: false`,
     * l'alternant et ses SA restent archivés, sinon ils sont actifs.
     */
    private async syncArchiveStatus(alternantId: string): Promise<void> {
        const all = await this.ruptures.findByAlternantId(alternantId);
        const quits = all.some((r) => r.poursuit_formation === false);
        if (quits) {
            const now = new Date();
            await this.sequences.setArchivedByAlternantId(alternantId, now);
            await this.alternants.setArchived(alternantId, now);
            logger.info({ alternantId }, 'Alternant archivé (rupture « quitte la formation »)');
        } else {
            const current = await this.alternants.findById(alternantId);
            if (current?.archived_at != null) {
                await this.sequences.setArchivedByAlternantId(alternantId, null);
                await this.alternants.setArchived(alternantId, null);
                logger.info({ alternantId }, 'Alternant désarchivé (plus aucune rupture « quitte »)');
            }
        }
    }

    async findByAlternantId(alternantId: string): Promise<Rupture[]> {
        return this.ruptures.findByAlternantId(alternantId);
    }

    async findByMonth(year: number, month: number): Promise<RuptureReportRow[]> {
        const { year: y, month: m } = requireMonth(year, month);
        const rows = await this.ruptures.findByMonth(y, m);
        const ids = [...new Set(rows.map((r) => r.alternant_id))];
        const alternants = await this.alternants.findByIds(ids);
        const byId = new Map(alternants.map((a) => [a._id, a]));
        return rows.map((rupture) => ({ rupture, alternant: byId.get(rupture.alternant_id) ?? null }));
    }

    async declare(input: DeclareRuptureInput): Promise<Rupture> {
        const alternant = await this.alternants.findById(input.alternantId);
        if (!alternant) throw new Error('Alternant introuvable');
        const dateRupture = requireValidDate(input.dateRupture, 'La date de la rupture');
        const motif = requireMotif(input.motif);
        if (typeof input.poursuitFormation !== 'boolean') {
            throw new Error('« L’apprenti poursuit la formation ? » est obligatoire');
        }
        // Entreprise pré-remplie depuis la fiche, modifiable à la saisie.
        const entreprise = input.entreprise?.trim() || alternant.company?.name?.trim() || null;
        const created = await this.ruptures.create({
            alternant_id: alternant._id,
            date_rupture: dateRupture,
            entreprise,
            motif,
            detail: input.detail?.trim() || null,
            poursuit_formation: input.poursuitFormation,
        });
        logger.info({ alternantId: alternant._id, ruptureId: created._id }, 'Rupture déclarée');
        await this.syncArchiveStatus(alternant._id);
        await this.notifyPedaOnDeclare(alternant, created);
        return created;
    }

    /**
     * Notifie l'équipe pédagogique (rôle PEDA + RESPONSABLE / ADMIN) qu'une
     * rupture vient d'être déclarée. Best-effort : un échec ne fait jamais
     * échouer la déclaration elle-même.
     */
    private async notifyPedaOnDeclare(alternant: Alternant, rupture: Rupture): Promise<void> {
        try {
            const [byRole, byPermission] = await Promise.all([
                this.userRepository.findByRoleIds([3]), // PEDA
                this.userRepository.findByPermissionIds([2, 3]), // RESPONSABLE, ADMIN
            ]);
            const map = new Map<number, UserRowJoined>();
            for (const u of byRole) map.set(u.id, u);
            for (const u of byPermission) map.set(u.id, u);
            const recipients = [...map.values()];
            if (recipients.length === 0) {
                logger.warn('rupture: aucun destinataire Peda, notification ignorée');
                return;
            }
            const name = `${alternant.first_name} ${alternant.last_name}`.trim() || 'Un alternant';
            const date = new Date(rupture.date_rupture).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
            const devenir = rupture.poursuit_formation ? 'poursuit la formation' : 'quitte la formation';
            const entreprise = rupture.entreprise ? ` (${rupture.entreprise})` : '';
            await Promise.all(
                recipients.map((user) =>
                    this.notificationService.create({
                        userId: user.id,
                        type: 'rupture_declared',
                        category: 'peda',
                        level: 'warning',
                        title: 'Rupture déclarée',
                        message: `Rupture déclarée pour ${name}${entreprise} le ${date} — ${devenir}.`,
                        link: `/peda/alternants/${alternant._id}`,
                    }),
                ),
            );
        } catch (err) {
            logger.error({ err, alternantId: alternant._id }, 'rupture: échec notification Peda');
        }
    }

    async update(id: string, input: UpdateRuptureInput): Promise<Rupture | null> {
        const existing = await this.ruptures.findById(id);
        if (!existing) return null;
        const patch: Record<string, unknown> = {};
        if (input.dateRupture !== undefined) patch.date_rupture = requireValidDate(input.dateRupture, 'La date de la rupture');
        if (input.motif !== undefined) patch.motif = requireMotif(input.motif);
        if (input.entreprise !== undefined) patch.entreprise = input.entreprise?.trim() || null;
        if (input.detail !== undefined) patch.detail = input.detail?.trim() || null;
        if (input.poursuitFormation !== undefined) {
            if (typeof input.poursuitFormation !== 'boolean') {
                throw new Error('« L’apprenti poursuit la formation ? » est obligatoire');
            }
            patch.poursuit_formation = input.poursuitFormation;
        }
        const updated = await this.ruptures.update(id, patch);
        logger.info({ ruptureId: id }, 'Rupture modifiée');
        await this.syncArchiveStatus(existing.alternant_id);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const existing = await this.ruptures.findById(id);
        const deleted = await this.ruptures.delete(id);
        if (deleted) {
            logger.info({ ruptureId: id }, 'Rupture supprimée');
            if (existing) await this.syncArchiveStatus(existing.alternant_id);
        }
        return deleted;
    }
}
