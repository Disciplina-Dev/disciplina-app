import { authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import {
    AlternantService,
    CompanyInput,
    CreateAlternantInput,
    UpdateAlternantInput,
} from '../../services/AlternantService';
import { AlternantSequenceContacts, AlternantSequenceStatus } from '../../types/alternant.types';
import { alternantToGql, sequenceToGql } from '../../services/mappers/alternant.mapper';

const alternantService = new AlternantService();

export const resolvers = {
    Query: {
        alternants: async (_: unknown, { search }: { search?: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const alternants = await alternantService.findAll(search);
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
    },
    Mutation: {
        createAlternant: async (_: unknown, { input }: { input: CreateAlternantInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await alternantService.create(input);
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
            return alternantService.delete(id);
        },
        changeAlternantCompany: async (
            _: unknown,
            { id, company }: { id: string; company: CompanyInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.changeCompany(id, company);
            return updated ? alternantToGql(updated) : null;
        },
        removeAlternantCompany: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.removeCompany(id);
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
        createSequence: async (
            _: unknown,
            { alternantId, prevueLe }: { alternantId: string; prevueLe: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const created = await alternantService.createManualSequence(alternantId, prevueLe);
            return sequenceToGql(created);
        },
        updateSequenceContacts: async (
            _: unknown,
            { id, contacts }: { id: string; contacts: Partial<AlternantSequenceContacts> },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.updateSequenceContacts(id, contacts);
            return updated ? sequenceToGql(updated) : null;
        },
        markSequence: async (
            _: unknown,
            { id, status }: { id: string; status: AlternantSequenceStatus },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.markSequence(id, status);
            return updated ? sequenceToGql(updated) : null;
        },
        completeSequence: async (_: unknown, { id, realiseeLe }: { id: string; realiseeLe: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            const updated = await alternantService.completeSequence(id, realiseeLe);
            return updated ? sequenceToGql(updated) : null;
        },
        deleteSequence: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.PEDA]);
            return alternantService.deleteSequence(id);
        },
    },
};
