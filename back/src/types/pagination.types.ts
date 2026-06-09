export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationArgs {
    first?: number;
    after?: string;
}

export interface PageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
}

export interface Edge<T> {
    node: T;
    cursor: string;
}

export interface Connection<T> {
    edges: Edge<T>[];
    pageInfo: PageInfo;
}
