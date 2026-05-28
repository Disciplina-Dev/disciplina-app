import dotenv from 'dotenv';

dotenv.config({
    path: ['.env', '../.env'],
});

const INSECURE_DEFAULTS = new Set(['super-secret-key-change-in-production', 'supersecret123', 'changeme']);

const errors: string[] = [];

function requireString(key: string): string {
    const raw = process.env[key];
    if (raw === undefined || raw === '') {
        errors.push(`${key} is required`);
        return '';
    }
    return raw;
}

function optionalString(key: string, fallback?: string): string | undefined {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    return raw;
}

function stringWithDefault(key: string, fallback: string): string {
    const raw = process.env[key];
    return raw === undefined || raw === '' ? fallback : raw;
}

function numberWithDefault(key: string, fallback: number): number {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        errors.push(`${key} must be a number, got "${raw}"`);
        return fallback;
    }
    return n;
}

const data = {
    API_PORT: numberWithDefault('API_PORT', 4000),

    APP_BASE_URL: stringWithDefault('APP_BASE_URL', 'http://localhost:4000'),
    RELANCE_HMAC_SECRET: stringWithDefault('RELANCE_HMAC_SECRET', 'change-this-relance-secret'),
    GOOGLE_STATE_SECRET: stringWithDefault('GOOGLE_STATE_SECRET', 'change-this-google-state-secret'),

    CLASSMARKER_API_NAME: optionalString('CLASSMARKER_API_NAME'),
    CLASSMARKER_API_KEY: optionalString('CLASSMARKER_API_KEY'),
    CLASSMARKER_API_SECRET: optionalString('CLASSMARKER_API_SECRET'),
    MYSQL_HOST: process.env.NODE_ENV === 'test' ? 'localhost' : stringWithDefault('MYSQL_HOST', 'localhost'),
    MYSQL_PORT: numberWithDefault('MYSQL_PORT', 3306),
    MYSQL_USER: stringWithDefault('MYSQL_USER', 'root'),
    MYSQL_ROOT_PASSWORD: requireString('MYSQL_ROOT_PASSWORD'),
    MYSQL_DATABASE: requireString('MYSQL_DATABASE'),

    MONGO_ROOT_USERNAME: requireString('MONGO_ROOT_USERNAME'),
    MONGO_ROOT_PASSWORD: requireString('MONGO_ROOT_PASSWORD'),
    MONGO_PORT: numberWithDefault('MONGO_PORT', 27017),
    MONGO_HOST: process.env.NODE_ENV === 'test' ? 'localhost' : stringWithDefault('MONGO_HOST', 'nosql-db'),
    MONGO_DB_NAME: stringWithDefault('MONGO_DB_NAME', 'human_ressources'),

    JWT_SECRET: requireString('JWT_SECRET'),
    SESSION_SECRET: requireString('SESSION_SECRET'),

    GOOGLE_CLIENT_ID: optionalString('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalString('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: stringWithDefault('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google'),

    SMTP_HOST: optionalString('SMTP_HOST'),
    SMTP_PORT: numberWithDefault('SMTP_PORT', 587),
    SMTP_SECURE: optionalString('SMTP_SECURE'),
    SMTP_USER: optionalString('SMTP_USER'),
    SMTP_PASS: optionalString('SMTP_PASS'),
    SMTP_FROM: optionalString('SMTP_FROM'),

    FILIZ_CLIENT_ID: requireString('FILIZ_CLIENT_ID'),
    FILIZ_CLIENT_SECRET: requireString('FILIZ_CLIENT_SECRET'),
    FILIZ_AUDIENCE: requireString('FILIZ_AUDIENCE'),
    FILIZ_BASE_URI: optionalString('FILIZ_BASE_URI', 'https://api.dev.partners.filiz.io'),
    FILIZ_AUTH_URI: requireString('FILIZ_AUTH_URI'),

    YOUSIGN_API_KEY: optionalString('YOUSIGN_API_KEY', 'sandbox_yousign_key_placeholder'),
    YOUSIGN_BASE_URL: stringWithDefault('YOUSIGN_BASE_URL', 'https://api-sandbox.yousign.app/v3'),
};

if (errors.length > 0) {
    console.error('Invalid environment variables:');
    for (const message of errors) {
        console.error(`  ${message}`);
    }
    process.exit(1);
}

if (INSECURE_DEFAULTS.has(data.JWT_SECRET)) {
    console.error('JWT_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (INSECURE_DEFAULTS.has(data.SESSION_SECRET)) {
    console.error('SESSION_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

export const env = data;
