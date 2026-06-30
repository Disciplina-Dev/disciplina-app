import ExcelJS from 'exceljs';
import { KpiRepository } from '../repositories/mysql/KpiRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { Role } from '../types/user.types';
import { KpiRow, KpiSite, KpiUpsertInput, KpiMetricColumn, KPI_METRIC_COLUMNS, KPI_SITES } from '../types/kpi.types';

export interface KpiMonthEntry {
    month: number;
    metrics: Record<KpiMetricColumn, number>;
}

export interface KpiUserSummary {
    userId: number | null;
    userName: string;
    totals: Record<KpiMetricColumn, number>;
    months: KpiMonthEntry[];
}

export interface KpiAnnualSummary {
    year: number;
    site: string;
    totals: Record<KpiMetricColumn, number>;
    users: KpiUserSummary[];
}

export interface KpiMonthlyDetail {
    year: number;
    site: string;
    months: {
        month: number;
        totals: Record<KpiMetricColumn, number>;
        users: { userId: number | null; userName: string; metrics: Record<KpiMetricColumn, number> }[];
    }[];
}

export interface KpiWeeklyDetail {
    year: number;
    site: string;
    weeks: {
        week: number;
        month: number;
        totals: Record<KpiMetricColumn, number>;
        users: { userId: number | null; userName: string; metrics: Record<KpiMetricColumn, number> }[];
    }[];
}

export interface KpiImportResult {
    imported: number;
    errors: string[];
    /** Noms présents dans l'Excel sans user correspondant : lignes ignorées. */
    unmatched: string[];
}

export interface KpiSelectableUser {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

function emptyMetrics(): Record<KpiMetricColumn, number> {
    return Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, 0])) as Record<KpiMetricColumn, number>;
}

function metricsOf(row: KpiRow): Record<KpiMetricColumn, number> {
    return Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, Number(row[c]) || 0])) as Record<
        KpiMetricColumn,
        number
    >;
}

function addInto(target: Record<KpiMetricColumn, number>, source: Record<KpiMetricColumn, number>): void {
    for (const c of KPI_METRIC_COLUMNS) target[c] += source[c];
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalize(value: unknown): string {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[.'’*-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** "Catégorie" cell → commercial_kpi column. Keys are normalized cell text. */
const CATEGORY_TO_COLUMN: Record<string, KpiMetricColumn> = {
    oui: 'count_oui',
    'oui of': 'count_oui_of',
    non: 'count_non',
    'ne repond pas': 'count_ne_repond_pas',
    'ne reponds pas': 'count_ne_repond_pas',
    'a reflechir': 'count_a_reflechir',
    relance: 'count_relance',
    'total d appel': 'total_appels',
    'total d appels': 'total_appels',
    'total appel': 'total_appels',
    'total appels': 'total_appels',
    'total trier': 'total_trie',
    'total trie': 'total_trie',
    'nbre d ent ferme': 'nbre_ent_ferme',
    'nbre ent ferme': 'nbre_ent_ferme',
    'nbre d ent ouvert': 'nbre_ent_ouvert',
    'nbre ent ouvert': 'nbre_ent_ouvert',
    'visite entreprise': 'visites_terrain',
    'visite entreprises': 'visites_terrain',
    'visites entreprises': 'visites_terrain',
    'visites terrain': 'visites_terrain',
};

const MONTH_NAMES = [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre',
];

/** Header cells (and beyond) that end the commercial-name columns. */
const NAME_COLUMN_TERMINATORS = /^(total|global|comparatif|ecart|evolution)/;

/**
 * Header cells that look like a name column but are not a commercial: metric
 * columns interleaved among the names (ex: "Immersion"). Skipped without
 * stopping the scan, so real commercials placed after them are still read.
 */
const NAME_COLUMN_IGNORED = /^(immersion|non employe)/;

interface ParsedEntry {
    /** Metric values; only categories actually present in the sheet are set. */
    metrics: Partial<Record<KpiMetricColumn, number>>;
}

/** key = `${name}|${year}|${month}|${week}` — week is 0 for monthly sheets */
type ParsedSheet = Map<string, ParsedEntry>;

export class KpiService {
    private kpiRepository = new KpiRepository();
    private userRepository = new UserRepository();

    async getAvailableYears(): Promise<number[]> {
        return this.kpiRepository.getAvailableYears();
    }

    /** Commerciaux sélectionnables pour la saisie manuelle (rattachés à un vrai user). */
    async getSelectableUsers(): Promise<KpiSelectableUser[]> {
        const users = await this.userRepository.findByRoles([Role.ADMIN, Role.RESPONSABLE, Role.COMMERCIAL]);
        return users
            .map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name, role: u.role }))
            .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    }

    async getAnnualSummary(year: number, site: string): Promise<KpiAnnualSummary> {
        const rows = await this.kpiRepository.findByYearAndSite(year, site);
        const byUser = new Map<string, KpiUserSummary>();
        const totals = emptyMetrics();

        for (const row of rows) {
            let user = byUser.get(row.user_name);
            if (!user) {
                user = { userId: row.user_id, userName: row.user_name, totals: emptyMetrics(), months: [] };
                byUser.set(row.user_name, user);
            }
            const metrics = metricsOf(row);
            user.months.push({ month: row.month, metrics });
            addInto(user.totals, metrics);
            addInto(totals, metrics);
        }

        return { year, site, totals, users: [...byUser.values()] };
    }

    async getMonthlyDetail(year: number, site: string): Promise<KpiMonthlyDetail> {
        const rows = await this.kpiRepository.findByYearAndSite(year, site);
        const byMonth = new Map<number, KpiMonthlyDetail['months'][number]>();

        for (const row of rows) {
            let month = byMonth.get(row.month);
            if (!month) {
                month = { month: row.month, totals: emptyMetrics(), users: [] };
                byMonth.set(row.month, month);
            }
            const metrics = metricsOf(row);
            month.users.push({ userId: row.user_id, userName: row.user_name, metrics });
            addInto(month.totals, metrics);
        }

        return { year, site, months: [...byMonth.values()].sort((a, b) => a.month - b.month) };
    }

    async getWeeklyDetail(year: number, site: string): Promise<KpiWeeklyDetail> {
        const rows = await this.kpiRepository.findWeeklyByYearAndSite(year, site);
        const byWeek = new Map<number, KpiWeeklyDetail['weeks'][number]>();

        for (const row of rows) {
            let week = byWeek.get(row.week);
            if (!week) {
                week = { week: row.week, month: row.month, totals: emptyMetrics(), users: [] };
                byWeek.set(row.week, week);
            }
            const metrics = metricsOf(row);
            week.users.push({ userId: row.user_id, userName: row.user_name, metrics });
            addInto(week.totals, metrics);
        }

        return { year, site, weeks: [...byWeek.values()].sort((a, b) => a.month - b.month || a.week - b.week) };
    }

    async manualUpsert(data: KpiUpsertInput): Promise<void> {
        this.validateInput(data);
        const user = await this.userRepository.findById(data.user_id as number);
        if (!user) throw new Error('Unknown user');
        // Le nom n'est jamais pris du client : snapshot fiable depuis la base.
        await this.kpiRepository.upsert({
            ...data,
            user_id: user.id,
            user_name: `${user.first_name} ${user.last_name}`,
        });
    }

    /**
     * Parses the "Suivi commercial" workbook (scripts/kpi_commercial.xlsx layout).
     *
     * Sheets are transposed: header row `Période | Catégorie | <commercial...>`,
     * then one block per period (month name or week label in column A), one row
     * per category inside the block, one value column per commercial.
     *
     * - "C.R Mois YYYY" sheets carry the official monthly figures but only a
     *   subset of categories (Oui, Oui OF, À réfléchir, Total d'appel, Total
     *   trier, Nbre d'ent. ouvert).
     * - "C.R Sem. YYYY" sheets carry the full category set per week (adds Non,
     *   Ne répond pas, Relance, Nbre d'ent. fermé, Visite entreprises). Each
     *   week is stored as its own row (week = 1-53) and also summed into the
     *   monthly aggregate row (week = 0); a category coming from a Mois sheet
     *   always wins over the weekly aggregate for the same (commercial, month).
     *
     * Week labels: `S2 - Janvier`, then bare `S3`, `S4`… inherit the current
     * month; `S18 - Fin Avril début Mai` counts as the later month; a month
     * jumping backwards (`S01 - Fin Déc. début Janv.`) rolls into the next year.
     */
    async importFromExcel(buffer: Buffer, site: string): Promise<KpiImportResult> {
        if (!KPI_SITES.includes(site as KpiSite)) {
            throw new Error(`Invalid site '${site}', expected one of ${KPI_SITES.join(', ')}`);
        }
        const workbook = new ExcelJS.Workbook();
        // Cast : drift de types entre @types/node (Buffer<ArrayBufferLike>) et la signature ExcelJS.
        await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
        const errors: string[] = [];

        const moisSheets = workbook.worksheets.filter((ws) => /mois/i.test(ws.name)).map((ws) => ws.name);
        const semSheets = workbook.worksheets.filter((ws) => /sem/i.test(ws.name)).map((ws) => ws.name);
        if (moisSheets.length === 0 && semSheets.length === 0) {
            return {
                imported: 0,
                unmatched: [],
                errors: [
                    `No 'C.R Mois' or 'C.R Sem.' sheet found (sheets: ${workbook.worksheets
                        .map((ws) => ws.name)
                        .join(', ')})`,
                ],
            };
        }

        // Monthly sheets first: their categories take precedence over weekly sums.
        const merged = new Map<string, { input: KpiUpsertInput; fromMois: Set<KpiMetricColumn> }>();
        // Weekly rows are stored as-is on top of the monthly aggregates.
        const weeklyRows = new Map<string, KpiUpsertInput>();

        for (const sheetName of moisSheets) {
            const parsed = this.parseSheet(workbook, sheetName, false, errors);
            if (!parsed) continue;
            for (const [key, entry] of parsed) {
                const target = this.mergeTarget(merged, this.monthKey(key), site as KpiSite);
                for (const [column, value] of Object.entries(entry.metrics) as [KpiMetricColumn, number][]) {
                    target.input[column] = value;
                    target.fromMois.add(column);
                }
            }
        }

        for (const sheetName of semSheets) {
            const parsed = this.parseSheet(workbook, sheetName, true, errors);
            if (!parsed) continue;
            for (const [key, entry] of parsed) {
                // Monthly aggregate: only categories the Mois sheets don't provide.
                const target = this.mergeTarget(merged, this.monthKey(key), site as KpiSite);
                for (const [column, value] of Object.entries(entry.metrics) as [KpiMetricColumn, number][]) {
                    if (!target.fromMois.has(column)) {
                        target.input[column] = (target.input[column] ?? 0) + value;
                    }
                }

                // Raw weekly row.
                const [name, year, month, week] = key.split('|');
                const weekly = weeklyRows.get(key) ?? {
                    user_name: name,
                    year: Number(year),
                    month: Number(month),
                    week: Number(week),
                    site: site as KpiSite,
                };
                for (const [column, value] of Object.entries(entry.metrics) as [KpiMetricColumn, number][]) {
                    weekly[column] = (weekly[column] ?? 0) + value;
                }
                weeklyRows.set(key, weekly);
            }
        }

        const rows = [...merged.values()].map((m) => m.input).concat([...weeklyRows.values()]);
        const userIds = await this.userIdsByName(rows.map((r) => r.user_name ?? ''));

        // Rattachement obligatoire à un vrai user : les noms non résolus sont ignorés et signalés.
        const resolved: KpiUpsertInput[] = [];
        const unmatched = new Set<string>();
        for (const row of rows) {
            const id = userIds.get(normalize(row.user_name)) ?? null;
            if (id == null) {
                if (row.user_name) unmatched.add(row.user_name);
                continue;
            }
            row.user_id = id;
            resolved.push(row);
        }

        await this.kpiRepository.bulkUpsert(resolved);
        return { imported: resolved.length, errors, unmatched: [...unmatched] };
    }

    /** `${name}|${year}|${month}|${week}` → monthly key (week forced to 0). */
    private monthKey(key: string): string {
        const [name, year, month] = key.split('|');
        return `${name}|${year}|${month}|0`;
    }

    private mergeTarget(
        merged: Map<string, { input: KpiUpsertInput; fromMois: Set<KpiMetricColumn> }>,
        key: string,
        site: KpiSite,
    ): { input: KpiUpsertInput; fromMois: Set<KpiMetricColumn> } {
        let target = merged.get(key);
        if (!target) {
            const [name, year, month] = key.split('|');
            target = {
                input: { user_name: name, year: Number(year), month: Number(month), week: 0, site },
                fromMois: new Set(),
            };
            merged.set(key, target);
        }
        return target;
    }

    /** Parses one transposed sheet. `weekly` switches period parsing from month names to week labels. */
    private parseSheet(
        workbook: ExcelJS.Workbook,
        sheetName: string,
        weekly: boolean,
        errors: string[],
    ): ParsedSheet | null {
        const sheetYear = this.extractYear(sheetName);
        if (!sheetYear) {
            errors.push(`Sheet '${sheetName}': no year in sheet name, skipped`);
            return null;
        }

        const ws = workbook.getWorksheet(sheetName);
        if (!ws) {
            errors.push(`Sheet '${sheetName}': sheet not found, skipped`);
            return null;
        }

        const matrix: unknown[][] = [];
        ws.eachRow({ includeEmpty: true }, (row) => {
            const vals = row.values as unknown[];
            matrix.push(vals.slice(1).map((v) => v ?? null));
        });

        // Header row: 'Catégorie' in column B; commercial names start in column C
        // and stop at the first empty/total-like cell.
        const headerIndex = matrix.findIndex((row) => normalize(row?.[1]) === 'categorie');
        if (headerIndex === -1) {
            errors.push(`Sheet '${sheetName}': no 'Catégorie' header row found, skipped`);
            return null;
        }
        const header = matrix[headerIndex];
        const nameColumns: { column: number; name: string }[] = [];
        for (let c = 2; c < header.length; c++) {
            const name = String(header[c] ?? '').trim();
            if (!name || NAME_COLUMN_TERMINATORS.test(normalize(name))) break;
            if (NAME_COLUMN_IGNORED.test(normalize(name))) continue;
            nameColumns.push({ column: c, name });
        }
        if (nameColumns.length === 0) {
            errors.push(`Sheet '${sheetName}': no commercial columns found, skipped`);
            return null;
        }

        const parsed: ParsedSheet = new Map();
        let month: number | null = null;
        let week: number | null = null; // weekly sheets only
        let yearOffset = 0;

        for (let r = headerIndex + 1; r < matrix.length; r++) {
            const cells = matrix[r] ?? [];

            const periodLabel = String(cells[0] ?? '').trim();
            if (periodLabel) {
                const labelMonth = this.monthFromLabel(periodLabel);
                if (labelMonth) {
                    // Weekly sheets run Jan→Dec then 'S01 - Fin Déc. début Janv.':
                    // a backwards month jump means the week spills into next year.
                    if (weekly && month && labelMonth < month) yearOffset += 1;
                    month = labelMonth;
                } else if (!weekly) {
                    month = null; // unknown block label on a monthly sheet: don't attribute rows to the previous month
                }
                if (weekly) {
                    const weekMatch = periodLabel.match(/\bS\s*0*(\d{1,2})\b/i);
                    week = weekMatch ? Number(weekMatch[1]) : null;
                    if (!week) errors.push(`${sheetName} row ${r + 1}: no week number in '${periodLabel}'`);
                }
            }

            const column = CATEGORY_TO_COLUMN[normalize(cells[1])];
            if (!column) continue;
            if (!month || (weekly && !week)) {
                errors.push(
                    `${sheetName} row ${r + 1}: category outside a ${weekly ? 'week' : 'month'} block, skipped`,
                );
                continue;
            }

            for (const { column: c, name } of nameColumns) {
                const value = Number(cells[c]);
                if (cells[c] == null || !Number.isFinite(value)) continue;
                const key = `${name}|${sheetYear + yearOffset}|${month}|${weekly ? week : 0}`;
                const entry = parsed.get(key) ?? { metrics: {} };
                entry.metrics[column] = (entry.metrics[column] ?? 0) + Math.round(value);
                parsed.set(key, entry);
            }
        }

        return parsed;
    }

    /**
     * Month from a period label: full or abbreviated French month names
     * ('Sept.', 'Janv.', 'Déc.'). When several months appear ('Fin Avril début
     * Mai'), the last one wins.
     */
    private monthFromLabel(label: string): number | null {
        let found: number | null = null;
        for (const token of normalize(label).split(' ')) {
            if (token.length < 3) continue;
            const index = MONTH_NAMES.findIndex((m) => m.startsWith(token));
            if (index !== -1) found = index + 1;
        }
        return found;
    }

    private validateInput(data: KpiUpsertInput): void {
        if (!Number.isInteger(data.user_id)) throw new Error('user_id is required');
        if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) throw new Error('Invalid year');
        if (!Number.isInteger(data.month) || data.month < 1 || data.month > 12) throw new Error('Invalid month (1-12)');
        if (data.week != null && (!Number.isInteger(data.week) || data.week < 0 || data.week > 53)) {
            throw new Error('Invalid week (0 = monthly, 1-53)');
        }
        if (!KPI_SITES.includes(data.site)) throw new Error(`Invalid site, expected one of ${KPI_SITES.join(', ')}`);
        for (const c of KPI_METRIC_COLUMNS) {
            const value = data[c];
            if (value != null && (!Number.isInteger(value) || value < 0))
                throw new Error(`Invalid ${c}: must be a non-negative integer`);
        }
    }

    private extractYear(cell: unknown): number | null {
        const match = String(cell ?? '').match(/\b(20\d{2})\b/);
        return match ? Number(match[1]) : null;
    }

    /**
     * Resolves Excel header names (first name only, ex: "Amanda") to user ids.
     * Matches on the full "first last" name and, as a fallback, on the first
     * name alone when it is unambiguous (a single user carries it). First names
     * shared by several users are left unresolved to avoid mis-attribution.
     */
    private async userIdsByName(names: string[]): Promise<Map<string, number>> {
        const users = await this.userRepository.findByRoles([Role.ADMIN, Role.RESPONSABLE, Role.COMMERCIAL, Role.RH]);
        const wanted = new Set(names.map(normalize));

        // Count first-name occurrences to detect ambiguity.
        const firstNameCount = new Map<string, number>();
        for (const user of users) {
            const first = normalize(user.first_name);
            firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
        }

        const map = new Map<string, number>();
        for (const user of users) {
            const full = normalize(`${user.first_name} ${user.last_name}`);
            if (wanted.has(full)) map.set(full, user.id);

            const first = normalize(user.first_name);
            if (wanted.has(first) && firstNameCount.get(first) === 1 && !map.has(first)) {
                map.set(first, user.id);
            }
        }
        return map;
    }
}
