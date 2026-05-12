import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const INSECURE_DEFAULTS = new Set([
    'super-secret-key-change-in-production',
    'supersecret123',
    'changeme',
]);

const schema = z.object({
    API_PORT: z.coerce.number().default(4000),

    MYSQL_HOST: z.string().default('sql-db'),
    MYSQL_PORT: z.coerce.number().default(3306),
    MYSQL_USER: z.string().default('root'),
    MYSQL_ROOT_PASSWORD: z.string().min(1, 'MYSQL_PASSWORD is required'),
    MYSQL_DATABASE: z.string().min(1, 'MYSQL_DATABASE is required'),

    MONGO_ROOT_USERNAME: z.string().min(1, 'MONGO_ROOT_USERNAME is required'),
    MONGO_ROOT_PASSWORD: z.string().min(1, 'MONGO_ROOT_PASSWORD is required'),
    MONGO_PORT: z.coerce.number().default(27017),

    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    APP_BASE_URL: z.string().default('http://localhost:4000'),
    RELANCE_HMAC_SECRET: z.string().default('change-this-relance-secret'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:');
    for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

const data = parsed.data;

if (INSECURE_DEFAULTS.has(data.JWT_SECRET)) {
    console.error('JWT_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (INSECURE_DEFAULTS.has(data.SESSION_SECRET)) {
    console.error('SESSION_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

export const env = data;
