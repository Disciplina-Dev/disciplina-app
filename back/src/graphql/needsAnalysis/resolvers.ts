import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { authGuard, authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import { UserService } from '../../services/UserService';
import { regionFromSector } from '../../utils/sector';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';
import { encodeNeedsAnalysisCursor } from '../../repositories/mongo/NeedsAnalysisRepository';
import { toNeedsAnalysis } from '../../services/mappers/needsAnalysis.mapper';
import { OfferAbFilter, AbStatus } from '../../types/offer.types';
import {
    abDriveConfigService,
    abDriveConfigToGql,
    abFolderKey,
    AbFolderKind,
} from '../../services/AbDriveConfigService';

interface OfferFilterInput {
    search?: string;
    statuses?: string[];
    desiredTp?: string[];
    sectors?: string[];
    localisations?: string[];
    abStatus?: AbStatus;
}

function toOfferAbFilter(filter?: OfferFilterInput): OfferAbFilter | undefined {
    if (!filter) return undefined;
    return { ...filter };
}

const needsAnalysisService = new NeedsAnalysisService();
const userService = new UserService();

export const resolvers = {
    Query: {
        needsAnalysis: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return needsAnalysisService.findById(id);
        },
        needsAnalysesByCompany: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return needsAnalysisService.findByCompanyId(companyID);
        },
        needsAnalysesPage: async (
            _: unknown,
            { first, after, filter }: PaginationArgs & { filter?: OfferFilterInput },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const docs = await needsAnalysisService.findPage(pageSize, after, toOfferAbFilter(filter));
            const conn = buildConnection(docs, encodeNeedsAnalysisCursor, pageSize);
            return {
                edges: conn.edges.map((edge) => ({ ...edge, node: toNeedsAnalysis(edge.node) })),
                pageInfo: conn.pageInfo,
            };
        },
        abDriveConfig: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const config = await abDriveConfigService.getConfig();
            return abDriveConfigToGql(config);
        },
        needsAnalysesForDashboard: async (_: unknown, { limit }: { limit?: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            // Le RH ne voit que les AB de ses secteurs. Les admin/responsables (ADMIN,
            // RESPONSABLE) voient tous les secteurs.
            let regions: string[] | undefined;
            if (context.user.permission !== Permission.ADMIN && context.user.permission !== Permission.RESPONSABLE) {
                const user = await userService.findById(Number(context.user.id));
                const sectors = user?.sectors ?? [];
                const mapped = sectors
                    .map((s) => regionFromSector(s))
                    .filter((r): r is 'NORD' | 'OUEST' | 'SUD' => Boolean(r));
                if (mapped.length > 0) regions = mapped;
            }
            return needsAnalysisService.findForDashboard(limit ?? 5, regions);
        },
    },
    Mutation: {
        createNeedsAnalysis: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const ownedInput = {
                ...input,
                userID: context.user.role === JobRole.COMMERCIAL ? context.user.id : input.userID ?? context.user.id,
            };
            return needsAnalysisService.create(ownedInput);
        },
        updateNeedsAnalysis: async (_: unknown, { id, input }: { id: string; input: any }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            if (context.user.role === JobRole.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.salerInfo?.id && existing.salerInfo.id !== context.user.id) {
                    throw new Error('Forbidden: You can only edit your own needs analyses');
                }
            }
            return needsAnalysisService.update(id, input);
        },
        deleteNeedsAnalysis: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            if (context.user.role === JobRole.COMMERCIAL) {
                const existing = await needsAnalysisService.findById(id);
                if (existing?.salerInfo?.id && existing.salerInfo.id !== context.user.id) {
                    throw new Error('Forbidden: You can only delete your own needs analyses');
                }
            }
            return needsAnalysisService.delete(id);
        },
        updateAbDriveConfig: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
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
