import { GraphQLError } from 'graphql';
import { authGuard } from '../authGuard';
import { Permission } from '../../types/user.types';
import { sectorService } from '../../services/SectorService';
import type { Sector, SectorLevel } from '../../repositories/mysql/SectorRepository';

const LEVELS: SectorLevel[] = ['region', 'sector', 'commune'];

export const sectorResolvers = {
    Query: {
        sectors: async (_: unknown, args: { level?: string | null; parentId?: number | null }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            const { level, parentId } = args;
            if (level != null && !LEVELS.includes(level as SectorLevel)) {
                throw new GraphQLError(`Invalid sector level: ${level}`, { extensions: { code: 'BAD_USER_INPUT' } });
            }
            const nodes = parentId != null ? await sectorService.children(parentId) : await sectorService.list();
            return level ? nodes.filter((s) => s.level === level) : nodes;
        },
    },
    Sector: {
        communes: (sector: Sector) => sectorService.communesOf(sector.id),
    },
};
