import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';

const needsAnalysisService = new NeedsAnalysisService();

export const resolvers = {
    Query: {
        needsAnalyses: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return needsAnalysisService.findAll();
        },
        needsAnalysis: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return needsAnalysisService.findById(id);
        },
        needsAnalysesByCompany: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return needsAnalysisService.findByCompanyId(companyID);
        },
    },
    Mutation: {
        createNeedsAnalysis: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const ownedInput = {
                ...input,
                userID: context.user.role === Role.COMMERCIAL ? context.user.id : input.userID ?? context.user.id,
            };
            return needsAnalysisService.create(ownedInput);
        },
        updateNeedsAnalysis: async (_: unknown, { id, input }: { id: number; input: any }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.userID && existing.userID !== context.user.id) {
                    throw new Error('Forbidden: You can only edit your own needs analyses');
                }
            }
            return needsAnalysisService.update(id, input);
        },
        deleteNeedsAnalysis: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.userID && existing.userID !== context.user.id) {
                    throw new Error('Forbidden: You can only delete your own needs analyses');
                }
            }
            return needsAnalysisService.delete(id);
        },
    },
};
