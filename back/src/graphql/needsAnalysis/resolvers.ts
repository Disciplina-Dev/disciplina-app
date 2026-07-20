import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import {
    abDriveConfigService,
    abDriveConfigToGql,
    abFolderKey,
    AbFolderKind,
} from '../../services/AbDriveConfigService';

const needsAnalysisService = new NeedsAnalysisService();

export const resolvers = {
    Query: {
        needsAnalysis: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return needsAnalysisService.findById(id);
        },
        needsAnalysesByCompany: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return needsAnalysisService.findByCompanyId(companyID);
        },
        abDriveConfig: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const config = await abDriveConfigService.getConfig();
            return abDriveConfigToGql(config);
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
        updateNeedsAnalysis: async (_: unknown, { id, input }: { id: string; input: any }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.salerInfo?.id && existing.salerInfo.id !== context.user.id) {
                    throw new Error('Forbidden: You can only edit your own needs analyses');
                }
            }
            return needsAnalysisService.update(id, input);
        },
        deleteNeedsAnalysis: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.salerInfo?.id && existing.salerInfo.id !== context.user.id) {
                    throw new Error('Forbidden: You can only delete your own needs analyses');
                }
            }
            return needsAnalysisService.delete(id);
        },
        updateAbDriveConfig: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuard(context.user, [Role.RESPONSABLE]);
            const sectorFolders: Record<string, string> = {};
            for (const f of input.sectorFolders ?? []) {
                const folderId = (f.folderId ?? '').trim();
                if (folderId) sectorFolders[abFolderKey(f.sector, f.kind as AbFolderKind)] = folderId;
            }
            const updated = await abDriveConfigService.updateConfig({ sectorFolders });
            return abDriveConfigToGql(updated);
        },
    },
};
