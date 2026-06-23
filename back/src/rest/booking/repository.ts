import { query } from '../../db/mysql/connection';

/** Plage horaire locale "HH:MM"–"HH:MM". */
export type WorkingWindow = [string, string];
/** Plages par jour ISO (1=lundi … 7=dimanche). */
export type WorkingHours = Record<string, WorkingWindow[]>;

export interface BookingSettings {
    userId: number;
    slug: string;
    enabled: boolean;
    durationMin: number;
    bufferMin: number;
    timezone: string;
    minNoticeHours: number;
    maxDaysAhead: number;
    workingHours: WorkingHours;
    title: string;
    location: string | null;
    /** Objet du mail de confirmation (modèle copié). null = mail par défaut. */
    confirmationSubject: string | null;
    /** Corps HTML du mail de confirmation, avec variables {{nom}} {{date}} … */
    confirmationBody: string | null;
}

interface BookingRow {
    user_id: number;
    slug: string;
    enabled: number;
    duration_min: number;
    buffer_min: number;
    timezone: string;
    min_notice_hours: number;
    max_days_ahead: number;
    working_hours: WorkingHours | string | null;
    title: string;
    location: string | null;
    confirmation_subject: string | null;
    confirmation_body: string | null;
}

/** Plages par défaut : lun–ven 9h–12h et 14h–17h. */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
    '1': [['09:00', '12:00'], ['14:00', '17:00']],
    '2': [['09:00', '12:00'], ['14:00', '17:00']],
    '3': [['09:00', '12:00'], ['14:00', '17:00']],
    '4': [['09:00', '12:00'], ['14:00', '17:00']],
    '5': [['09:00', '12:00'], ['14:00', '17:00']],
};

function toSettings(row: BookingRow): BookingSettings {
    const wh = typeof row.working_hours === 'string' ? JSON.parse(row.working_hours) : row.working_hours;
    return {
        userId: row.user_id,
        slug: row.slug,
        enabled: Boolean(row.enabled),
        durationMin: row.duration_min,
        bufferMin: row.buffer_min,
        timezone: row.timezone,
        minNoticeHours: row.min_notice_hours,
        maxDaysAhead: row.max_days_ahead,
        workingHours: wh ?? {},
        title: row.title,
        location: row.location,
        confirmationSubject: row.confirmation_subject ?? null,
        confirmationBody: row.confirmation_body ?? null,
    };
}

export class BookingRepository {
    async findByUserId(userId: number): Promise<BookingSettings | null> {
        const rows = await query<BookingRow[]>('SELECT * FROM booking_settings WHERE user_id = ?', [userId]);
        return rows.length ? toSettings(rows[0]) : null;
    }

    async findBySlug(slug: string): Promise<BookingSettings | null> {
        const rows = await query<BookingRow[]>('SELECT * FROM booking_settings WHERE slug = ?', [slug]);
        return rows.length ? toSettings(rows[0]) : null;
    }

    async create(userId: number, slug: string): Promise<BookingSettings> {
        await query(
            'INSERT INTO booking_settings (user_id, slug, working_hours) VALUES (?, ?, ?)',
            [userId, slug, JSON.stringify(DEFAULT_WORKING_HOURS)],
        );
        return (await this.findByUserId(userId))!;
    }

    async update(userId: number, patch: Partial<BookingSettings>): Promise<BookingSettings> {
        const fields: string[] = [];
        const values: unknown[] = [];
        const set = (col: string, val: unknown) => { fields.push(`${col} = ?`); values.push(val); };

        if (patch.enabled !== undefined) set('enabled', patch.enabled ? 1 : 0);
        if (patch.durationMin !== undefined) set('duration_min', patch.durationMin);
        if (patch.bufferMin !== undefined) set('buffer_min', patch.bufferMin);
        if (patch.timezone !== undefined) set('timezone', patch.timezone);
        if (patch.minNoticeHours !== undefined) set('min_notice_hours', patch.minNoticeHours);
        if (patch.maxDaysAhead !== undefined) set('max_days_ahead', patch.maxDaysAhead);
        if (patch.workingHours !== undefined) set('working_hours', JSON.stringify(patch.workingHours));
        if (patch.title !== undefined) set('title', patch.title);
        if (patch.location !== undefined) set('location', patch.location);
        if (patch.confirmationSubject !== undefined) set('confirmation_subject', patch.confirmationSubject);
        if (patch.confirmationBody !== undefined) set('confirmation_body', patch.confirmationBody);

        if (fields.length) {
            values.push(userId);
            await query(`UPDATE booking_settings SET ${fields.join(', ')} WHERE user_id = ?`, values);
        }
        return (await this.findByUserId(userId))!;
    }
}
