import { authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import {
    AlternantService,
    CompanyInput,
    CreateAlternantInput,
    UpdateAlternantInput,
} from '../../services/AlternantService';
import {
    AlternantSequence,
    AlternantSequenceContacts,
    AlternantSequenceStatus,
    AlternantSequenceType,
} from '../../types/alternant.types';
import { alternantToGql, sequenceToGql } from '../../services/mappers/alternant.mapper';
import { ruptureToGql } from '../../services/mappers/rupture.mapper';
import { sessionToGql } from '../../services/mappers/session.mapper';
import { templateToGql, resolvedDocumentToGql } from '../../services/mappers/alternantDocumentTemplate.mapper';
import { CreateSessionInput, SessionService, UpdateSessionInput } from '../../services/SessionService';
import {
    AlternantDocumentTemplateInput,
    AlternantDocumentTemplateService,
} from '../../services/AlternantDocumentTemplateService';
import { RuptureService } from '../../services/RuptureService';
import { SaCalendarService } from '../../services/SaCalendarService';
import { SaDefaillanceService } from '../../services/SaDefaillanceService';
import { AlternantMentorChangeService } from '../../services/AlternantMentorChangeService';
import { AlternantIncidentService } from '../../services/AlternantIncidentService';
import { DeclareRuptureInput, UpdateRuptureInput } from '../../types/rupture.types';

const alternantService = new AlternantService();
const sessionService = new SessionService();
const ruptureService = new RuptureService();
const documentTemplateService = new AlternantDocumentTemplateService();
const saCalendarService = new SaCalendarService();
const defaillanceService = new SaDefaillanceService();
const mentorChangeService = new AlternantMentorChangeService();
const incidentService = new AlternantIncidentService();

/** Re-synchronise l'agenda Google des Pedas avec les SA actives d'un alternant. */
async function syncAlternantSequences(alternantId: string): Promise<void> {
    const sequences = await alternantService.findSequences(alternantId);
    await saCalendarService.syncSequencesForAllPedas(
        sequences.filter((s: AlternantSequence) => s.archived_at == null).map((s: AlternantSequence) => s._id),
    );
}

/** Après une rupture : supprime les événements si l'alternant est archivé, resynchronise sinon. */
async function reconcileAlternantArchive(alternantId: string): Promise<void> {
    const alternant = await alternantService.findById(alternantId);
    if (alternant?.archived_at != null) {
        await saCalendarService.removeSequencesForAllPedas(await alternantService.findSequences(alternantId));
    } else {
        await syncAlternantSequences(alternantId);
    }
}

async function sessionWithCount(id: string): Promise<object | null> {
    const session = await sessionService.findById(id);
    if (!session) return null;
    const count = await sessionService.countAlternants(id);
    return sessionToGql(session, count);
}

export const resolvers = {
    Query: {
        alternants: async (
            _: unknown,
            { search, includeArchived }: { search?: string; includeArchived?: boolean },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const alternants = await alternantService.findAll(search, includeArchived ?? false);
            return alternants.map(alternantToGql);
        },
        alternant: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const alternant = await alternantService.findById(id);
            return alternant ? alternantToGql(alternant) : null;
        },
        alternantSequences: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sequences = await alternantService.findSequences(alternantId);
            return sequences.map(sequenceToGql);
        },
        // Vérification de doublon en direct : existe-t-il déjà un alternant pour cet email ?
        alternantByEmail: async (_: unknown, { email }: { email: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const existing = await alternantService.findByEmail(email);
            return existing
                ? { exists: true, id: existing._id, fullName: `${existing.first_name} ${existing.last_name}`.trim() }
                : { exists: false, id: null, fullName: null };
        },
        sessions: async (_: unknown, { search }: { search?: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sessions = await sessionService.findAll(search);
            return Promise.all(sessions.map(async (s) => sessionToGql(s, await sessionService.countAlternants(s._id))));
        },
        session: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            return sessionWithCount(id);
        },
        sessionAlternants: async (_: unknown, { sessionId }: { sessionId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const session = await sessionService.findById(sessionId);
            if (!session) throw new Error('Session introuvable');
            const members = await alternantService.findBySessionId(sessionId);
            return members.map(alternantToGql);
        },
        ruptures: async (_: unknown, { year, month }: { year: number; month: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const rows = await ruptureService.findByMonth(year, month);
            return rows.map(({ rupture, alternant }) => ruptureToGql(rupture, alternant));
        },
        alternantRuptures: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const alternant = await alternantService.findById(alternantId);
            const ruptures = await ruptureService.findByAlternantId(alternantId);
            return ruptures.map((r) => ruptureToGql(r, alternant));
        },
        alternantDocumentTemplates: async (_: unknown, { type }: { type?: AlternantSequenceType }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const templates = await documentTemplateService.findAll(type);
            return templates.map(templateToGql);
        },
        alternantSequenceDocument: async (_: unknown, { sequenceId }: { sequenceId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const resolved = await alternantService.resolveSequenceDocument(sequenceId);
            return resolvedDocumentToGql(resolved);
        },
    },
    Mutation: {
        createAlternant: async (_: unknown, { input }: { input: CreateAlternantInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await alternantService.create(input);
            await syncAlternantSequences(created._id);
            return alternantToGql(created);
        },
        updateAlternant: async (
            _: unknown,
            { id, input }: { id: string; input: UpdateAlternantInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.update(id, input);
            return updated ? alternantToGql(updated) : null;
        },
        deleteAlternant: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sequences = await alternantService.findSequences(id);
            const deleted = await alternantService.delete(id);
            if (deleted) await saCalendarService.removeSequencesForAllPedas(sequences);
            return deleted;
        },
        changeAlternantCompany: async (
            _: unknown,
            { id, company }: { id: string; company: CompanyInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const before = await alternantService.findSequences(id);
            const updated = await alternantService.changeCompany(id, company);
            const after = await alternantService.findSequences(id);
            const afterIds = new Set(after.map((s) => s._id));
            await saCalendarService.removeSequencesForAllPedas(before.filter((s) => !afterIds.has(s._id)));
            await saCalendarService.syncSequencesForAllPedas(
                after.filter((s) => s.archived_at == null).map((s) => s._id),
            );
            return updated ? alternantToGql(updated) : null;
        },
        removeAlternantCompany: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sequences = await alternantService.findSequences(id);
            const updated = await alternantService.removeCompany(id);
            await saCalendarService.removeSequencesForAllPedas(sequences);
            return updated ? alternantToGql(updated) : null;
        },
        linkAlternant: async (_: unknown, { id, otherId }: { id: string; otherId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.linkAlternant(id, otherId);
            return updated ? alternantToGql(updated) : null;
        },
        unlinkAlternant: async (_: unknown, { id, otherId }: { id: string; otherId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.unlinkAlternant(id, otherId);
            return updated ? alternantToGql(updated) : null;
        },
        archiveAlternant: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sequences = await alternantService.findSequences(id);
            const updated = await alternantService.archive(id);
            await saCalendarService.removeSequencesForAllPedas(sequences);
            return updated ? alternantToGql(updated) : null;
        },
        unarchiveAlternant: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.unarchive(id);
            await syncAlternantSequences(id);
            return updated ? alternantToGql(updated) : null;
        },
        reportCompanyDefaillance: async (
            _: unknown,
            { alternantId, reason }: { alternantId: string; reason: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await defaillanceService.report(alternantId, reason);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        resolveCompanyDefaillance: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await defaillanceService.resolve(alternantId);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        declareMentorChange: async (
            _: unknown,
            {
                alternantId,
                newMentorName,
                newMentorEmail,
            }: { alternantId: string; newMentorName?: string | null; newMentorEmail?: string | null },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await mentorChangeService.declare(alternantId, newMentorName ?? null, newMentorEmail ?? null);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        markMentorChangeAvenantSigned: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await mentorChangeService.markAvenantSigned(alternantId);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        markMentorChangeOpcoDeclared: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await mentorChangeService.markOpcoDeclared(alternantId);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        reportIncident: async (
            _: unknown,
            {
                alternantId,
                description,
                occurredAt,
                declaredByCfa,
            }: { alternantId: string; description: string; occurredAt: string; declaredByCfa: boolean },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await incidentService.report(alternantId, description, new Date(occurredAt), declaredByCfa);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        markIncidentDeclarationDone: async (_: unknown, { alternantId }: { alternantId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await incidentService.markDeclarationDone(alternantId);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        markIncidentAnalysisDone: async (
            _: unknown,
            { alternantId, preventionMeasures }: { alternantId: string; preventionMeasures?: string | null },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            await incidentService.markAnalysisDone(alternantId, preventionMeasures ?? null);
            const updated = await alternantService.findById(alternantId);
            return updated ? alternantToGql(updated) : null;
        },
        createSequence: async (
            _: unknown,
            { alternantId, prevueLe, type }: { alternantId: string; prevueLe: string; type?: AlternantSequenceType },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await alternantService.createManualSequence(alternantId, prevueLe, type);
            await saCalendarService.syncSequencesForAllPedas([created._id]);
            return sequenceToGql(created);
        },
        rescheduleSequence: async (_: unknown, { id, prevueLe }: { id: string; prevueLe: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.rescheduleSequence(id, prevueLe);
            if (updated) await saCalendarService.syncSequencesForAllPedas([updated._id]);
            return updated ? sequenceToGql(updated) : null;
        },
        updateSequenceContacts: async (
            _: unknown,
            { id, contacts }: { id: string; contacts: Partial<AlternantSequenceContacts> },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.updateSequenceContacts(id, contacts);
            if (updated) await saCalendarService.syncSequencesForAllPedas([updated._id]);
            return updated ? sequenceToGql(updated) : null;
        },
        markSequence: async (
            _: unknown,
            { id, status }: { id: string; status: AlternantSequenceStatus },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.markSequence(id, status);
            if (updated) await saCalendarService.syncSequencesForAllPedas([updated._id]);
            return updated ? sequenceToGql(updated) : null;
        },
        completeSequence: async (_: unknown, { id, realiseeLe }: { id: string; realiseeLe: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.completeSequence(id, realiseeLe);
            if (updated) await syncAlternantSequences(updated.alternant_id);
            return updated ? sequenceToGql(updated) : null;
        },
        deleteSequence: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const sequence = await alternantService.findSequenceById(id);
            const deleted = await alternantService.deleteSequence(id);
            if (deleted && sequence) await saCalendarService.removeSequencesForAllPedas([sequence]);
            return deleted;
        },
        createSession: async (_: unknown, { input }: { input: CreateSessionInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await sessionService.create(input);
            return sessionToGql(created, 0);
        },
        updateSession: async (_: unknown, { id, input }: { id: string; input: UpdateSessionInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await sessionService.update(id, input);
            if (!updated) return null;
            return sessionToGql(updated, await sessionService.countAlternants(id));
        },
        deleteSession: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            return sessionService.delete(id);
        },
        assignAlternantToSession: async (
            _: unknown,
            { sessionId, alternantId }: { sessionId: string; alternantId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await sessionService.assignAlternant(sessionId, alternantId);
            if (!updated) return null;
            return sessionToGql(updated, await sessionService.countAlternants(sessionId));
        },
        removeAlternantFromSession: async (
            _: unknown,
            { sessionId, alternantId }: { sessionId: string; alternantId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await sessionService.unassignAlternant(sessionId, alternantId);
            if (!updated) return null;
            return sessionToGql(updated, await sessionService.countAlternants(sessionId));
        },
        declareRupture: async (_: unknown, { input }: { input: DeclareRuptureInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await ruptureService.declare(input);
            const alternant = await alternantService.findById(created.alternant_id);
            await reconcileAlternantArchive(created.alternant_id);
            return ruptureToGql(created, alternant);
        },
        updateRupture: async (_: unknown, { id, input }: { id: string; input: UpdateRuptureInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await ruptureService.update(id, input);
            if (!updated) return null;
            const alternant = await alternantService.findById(updated.alternant_id);
            await reconcileAlternantArchive(updated.alternant_id);
            return ruptureToGql(updated, alternant);
        },
        deleteRupture: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            return ruptureService.delete(id);
        },
        createAlternantDocumentTemplate: async (
            _: unknown,
            { input }: { input: AlternantDocumentTemplateInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await documentTemplateService.create(input);
            return templateToGql(created);
        },
        updateAlternantDocumentTemplate: async (
            _: unknown,
            { id, input }: { id: string; input: AlternantDocumentTemplateInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await documentTemplateService.update(id, input);
            return templateToGql(updated);
        },
        deleteAlternantDocumentTemplate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            return documentTemplateService.delete(id);
        },
        saveAlternantSequenceDocument: async (
            _: unknown,
            {
                sequenceId,
                input,
            }: {
                sequenceId: string;
                input: {
                    maitreApprentissage: string;
                    alternant: string;
                    formateur: string;
                    signatureMaitreApprentissage?: string | null;
                    signatureAlternant?: string | null;
                    signatureFormateur?: string | null;
                };
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const resolved = await alternantService.saveSequenceDocument(sequenceId, input);
            return resolvedDocumentToGql(resolved);
        },
    },
};
