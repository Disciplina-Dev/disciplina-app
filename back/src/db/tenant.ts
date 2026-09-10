import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env';
import type { Region } from '../types/tenant';

const regionStorage = new AsyncLocalStorage<Region>();

export function withRegion<T>(region: Region, fn: () => Promise<T>): Promise<T> {
    return regionStorage.run(region, fn);
}

export function syncWithRegion<T>(region: Region, fn: () => T): T {
    return regionStorage.run(region, fn);
}

export function getRegion(): Region {
    return regionStorage.getStore() ?? env.DB_DEFAULT_TENANT;
}