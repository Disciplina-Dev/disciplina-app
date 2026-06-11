import { Connection, DEFAULT_PAGE_SIZE } from '../types/pagination.types';

export { DEFAULT_PAGE_SIZE } from '../types/pagination.types';
export type { PaginationArgs, Connection, Edge, PageInfo } from '../types/pagination.types';

export const encodeCursor = (id: string): string => Buffer.from(id).toString('base64');

export const decodeCursor = (cursor: string): string => Buffer.from(cursor, 'base64').toString('utf-8');

export function buildConnection<T>(
    nodes: T[],
    getNodeId: (node: T) => string,
    first: number = DEFAULT_PAGE_SIZE,
): Connection<T> {
    const hasNextPage = nodes.length > first;
    const items = hasNextPage ? nodes.slice(0, first) : nodes;
    const edges = items.map((node) => ({ node, cursor: encodeCursor(getNodeId(node)) }));

    return {
        edges,
        pageInfo: {
            hasNextPage,
            hasPreviousPage: false,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
    };
}
