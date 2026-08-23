import { randomBytes } from 'crypto';
import { getConnection } from '../db/mysql/connection';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { NotificationRepository } from '../repositories/mongo/NotificationRepository';
import { MailTemplateModel, MailSignatureModel } from '../db/mongo/schemas/mailTemplate.schema';
import { UserRowJoined } from '../types/db-rows.types';
import { logger } from '../external/logger';
import { Permission } from '../types/user.types';
import { permissionToId } from './UserService';

/** Erreur métier portant le statut HTTP à renvoyer au client. */
export class UserDeletionError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export interface UserDeletionSummary {
    detached: { companies: number; companyConflicts: number; blacklistedCompanies: number };
    reassigned: { needsAnalyses: number; offers: number; candidates: number };
    purged: {
        todos: number;
        todoGroups: number;
        notifications: number;
        mailTemplates: number;
        mailSignatures: number;
    };
}

interface Affected {
    affectedRows: number;
}

/**
 * Suppression (soft delete) d'un user par un admin.
 *
 * La ligne users reste en base (`is_deleted = 1`) : les historiques
 * (contact_logs, candidate_history, KPI…) continuent de pointer dessus. Le user
 * sort de tous les workflows (login, listes, directory) via le filtre du
 * UserRepository ; sessions révoquées (refresh_tokens purgés, access tokens
 * morts sous TTL).
 *
 * Relations actives transférées à un user de même rôle quand `replacementUserId`
 * est fourni, sinon détachées (NULL / champ Mongo retiré) :
 * - MySQL : companies.user_id, company_conflict.user_id, companies_blacklist.user_id
 * - Mongo : needs_analysis.saler_info, offers.saler_info, candidates.owner
 *
 * Données strictement personnelles purgées : todos + groupes, booking_settings,
 * peda_config, refresh_tokens, notifications, modèles et signatures de mail.
 */
export class UserDeletionService {
    private userRepository = new UserRepository();
    private needsAnalysisRepository = new NeedsAnalysisRepository();
    private offerRepository = new OfferRepository();
    private candidateRepository = new CandidateRepository();
    private notificationRepository = new NotificationRepository();

    async deleteUser(actorId: number, targetId: number, replacementUserId?: number): Promise<UserDeletionSummary> {
        const target = await this.userRepository.findByIdIncludingDeleted(targetId);
        if (!target || target.is_deleted) {
            throw new UserDeletionError('User not found', 404);
        }
        if (targetId === actorId) {
            throw new UserDeletionError('Vous ne pouvez pas supprimer votre propre compte', 409);
        }
        if (target.permission_id === permissionToId(Permission.ADMIN)) {
            const activeAdmins = await this.userRepository.countActiveByPermissionId(target.permission_id);
            if (activeAdmins <= 1) {
                throw new UserDeletionError('Impossible de supprimer le dernier administrateur', 409);
            }
        }

        let replacement: UserRowJoined | null = null;
        if (replacementUserId !== undefined) {
            replacement = await this.resolveReplacement(target, replacementUserId);
        }

        const detached = await this.reassignAndDetach(target.id, replacement?.id ?? null);
        const reassignedAndPurged = await this.cleanupMongo(target.id, replacement);

        return { ...detached, ...reassignedAndPurged };
    }

    private async resolveReplacement(target: UserRowJoined, replacementUserId: number): Promise<UserRowJoined> {
        const replacement = await this.userRepository.findById(replacementUserId);
        if (!replacement || replacement.role_id !== target.role_id) {
            throw new UserDeletionError("Le remplaçant doit être un user actif du même rôle", 409);
        }
        return replacement;
    }

    /**
     * Phase MySQL, atomique : réassignation/détachement des relations actives,
     * purge des données personnelles, puis flag soft-delete de la ligne user.
     */
    private async reassignAndDetach(
        targetId: number,
        successorId: number | null,
    ): Promise<Pick<UserDeletionSummary, 'detached' | 'purged'>> {
        const conn = await getConnection();
        try {
            await conn.beginTransaction();

            // Relations actives : transférées au remplaçant, sinon détachées
            // (colonnes nullable — une entreprise vit sans commercial attitré).
            const companies = await conn.execute('UPDATE companies SET user_id = ? WHERE user_id = ?', [
                successorId,
                targetId,
            ]);
            const conflicts = await conn.execute('UPDATE company_conflict SET user_id = ? WHERE user_id = ?', [
                successorId,
                targetId,
            ]);
            const blacklist = await conn.execute('UPDATE companies_blacklist SET user_id = ? WHERE user_id = ?', [
                successorId,
                targetId,
            ]);

            // Les todos d'autres users assignés par le supprimé perdent leur attribution.
            await conn.execute('UPDATE todos SET assigned_by = NULL WHERE assigned_by = ?', [targetId]);

            // Données strictement personnelles.
            const todos = await conn.execute('DELETE FROM todos WHERE user_id = ?', [targetId]);
            const todoGroups = await conn.execute('DELETE FROM todo_groups WHERE user_id = ?', [targetId]);
            await conn.execute('DELETE FROM booking_settings WHERE user_id = ?', [targetId]);
            await conn.execute('DELETE FROM peda_config WHERE user_id = ?', [targetId]);
            await conn.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [targetId]);

            const flagged = await conn.execute(
                'UPDATE users SET is_deleted = 1, deleted_at = NOW(), password = ?, oauth_token = NULL, refresh_token = NULL WHERE id = ? AND is_deleted = 0',
                [randomBytes(32).toString('hex'), targetId],
            );
            if ((flagged[0] as unknown as Affected).affectedRows === 0) {
                throw new Error('User already deleted');
            }

            await conn.commit();

            return {
                detached: {
                    companies: (companies[0] as unknown as Affected).affectedRows,
                    companyConflicts: (conflicts[0] as unknown as Affected).affectedRows,
                    blacklistedCompanies: (blacklist[0] as unknown as Affected).affectedRows,
                },
                purged: {
                    todos: (todos[0] as unknown as Affected).affectedRows,
                    todoGroups: (todoGroups[0] as unknown as Affected).affectedRows,
                    notifications: 0,
                    mailTemplates: 0,
                    mailSignatures: 0,
                },
            };
        } catch (error) {
            await conn.rollback();
            logger.error({ err: error, userId: targetId }, 'User deletion: MySQL phase failed');
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Phase Mongo, best-effort séquentiel (précédent : deleteAndBlacklistCompany).
     * Un échec est logué mais ne rollback pas la phase MySQL déjà validée : le
     * user reste flaggé supprimé côté MySQL.
     */
    private async cleanupMongo(
        userId: number,
        replacement: UserRowJoined | null,
    ): Promise<Pick<UserDeletionSummary, 'reassigned' | 'purged'>> {
        try {
            const saler = replacement !== null ? { id: replacement.id, email: replacement.email } : null;
            const owner =
                replacement !== null
                    ? { user_id: replacement.id, name: `${replacement.first_name} ${replacement.last_name}`.trim() }
                    : null;

            const needsAnalyses = await this.needsAnalysisRepository.reassignSaler(userId, saler);
            const offers = await this.offerRepository.reassignSaler(userId, saler);
            const candidates = await this.candidateRepository.reassignOwner(userId, owner);

            const notifications = await this.notificationRepository.deleteAllForUser(userId);
            const mailTemplates = await MailTemplateModel.deleteMany({ user_id: userId });
            const mailSignatures = await MailSignatureModel.deleteMany({ user_id: userId });

            return {
                reassigned: { needsAnalyses, offers, candidates },
                purged: {
                    todos: 0,
                    todoGroups: 0,
                    notifications,
                    mailTemplates: mailTemplates.deletedCount,
                    mailSignatures: mailSignatures.deletedCount,
                },
            };
        } catch (error) {
            logger.error({ err: error, userId }, 'User deletion: MongoDB cleanup failed (best-effort)');
            return {
                reassigned: { needsAnalyses: 0, offers: 0, candidates: 0 },
                purged: {
                    todos: 0,
                    todoGroups: 0,
                    notifications: 0,
                    mailTemplates: 0,
                    mailSignatures: 0,
                },
            };
        }
    }
}
