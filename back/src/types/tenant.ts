export type Region = 'reunion' | 'annemasse';

export const VALID_REGIONS: readonly Region[] = ['reunion', 'annemasse'];

export function isRegion(value: unknown): value is Region {
    return typeof value === 'string' && (VALID_REGIONS as readonly string[]).includes(value);
}