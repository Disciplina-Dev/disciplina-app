import dotenv from 'dotenv';

dotenv.config({
    path: ['.env', '../.env'],
});

const INSECURE_DEFAULTS = new Set([
    'super-secret-key-change-in-production',
    'supersecret123',
    'changeme',
    'change-this-relance-secret',
    'change-this-google-state-secret',
    '7325fd3fc113dc0034d98ee93eb9a50fc4c71d2798c819bc4e3f7e7e2fb7a940',
]);

const errors: string[] = [];

function requireString(key: string): string {
    const raw = process.env[key];
    if (raw === undefined || raw === '') {
        errors.push(`${key} is required`);
        return '';
    }
    return raw;
}
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

function requireStringWithCIFallback(key: string, fallback: string): string {
    const raw = process.env[key];
    if (raw === undefined || raw === '') {
        if (IS_CI) return fallback;
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

const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof VALID_LOG_LEVELS)[number];

function parseLogLevel(raw: string | undefined, nodeEnv: string): LogLevel {
    if (!raw) return nodeEnv === 'production' ? 'info' : 'debug';
    if (!VALID_LOG_LEVELS.includes(raw as LogLevel)) {
        errors.push(`Invalid LOG_LEVEL: "${raw}". Must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
        return nodeEnv === 'production' ? 'info' : 'debug';
    }
    return raw as LogLevel;
}

const data = {
    NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
    LOG_LEVEL: parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV ?? 'development'),

    API_PORT: numberWithDefault('API_PORT', 4000),

    APP_BASE_URL: stringWithDefault('APP_BASE_URL', 'http://localhost:4000'),
    FRONTEND_BASE_URL: stringWithDefault('FRONTEND_BASE_URL', 'http://localhost:5173'),
    CORS_ORIGINS: stringWithDefault('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    RELANCE_HMAC_SECRET: stringWithDefault('RELANCE_HMAC_SECRET', 'change-this-relance-secret'),
    GOOGLE_STATE_SECRET: stringWithDefault('GOOGLE_STATE_SECRET', 'change-this-google-state-secret'),

    CLASSMARKER_API_NAME: optionalString('CLASSMARKER_API_NAME'),
    CLASSMARKER_API_KEY: optionalString('CLASSMARKER_API_KEY'),
    CLASSMARKER_API_SECRET: optionalString('CLASSMARKER_API_SECRET'),
    CLASSMARKER_WEBHOOK_SECRET: optionalString('CLASSMARKER_WEBHOOK_SECRET'),
    MYSQL_HOST: process.env.NODE_ENV === 'test' ? 'localhost' : stringWithDefault('MYSQL_HOST', 'localhost'),
    MYSQL_PORT: numberWithDefault('MYSQL_PORT', 3306),
    MYSQL_USER: stringWithDefault('MYSQL_USER', 'root'),
    MYSQL_ROOT_PASSWORD:
        process.env.NODE_ENV === 'production'
            ? optionalString('MYSQL_ROOT_PASSWORD') ?? ''
            : requireStringWithCIFallback('MYSQL_ROOT_PASSWORD', 'ci-mysql-password'),
    MYSQL_DATABASE: requireStringWithCIFallback('MYSQL_DATABASE', 'disciplina'),
    MYSQL_URI: optionalString('MYSQL_URI'),

    MONGO_URI: optionalString('MONGO_URI'),
    MONGO_ROOT_USERNAME:
        process.env.NODE_ENV === 'production'
            ? optionalString('MONGO_ROOT_USERNAME') ?? ''
            : requireString('MONGO_ROOT_USERNAME'),
    MONGO_ROOT_PASSWORD:
        process.env.NODE_ENV === 'production'
            ? optionalString('MONGO_ROOT_PASSWORD') ?? ''
            : requireString('MONGO_ROOT_PASSWORD'),
    MONGO_PORT: numberWithDefault('MONGO_PORT', 27017),
    MONGO_HOST: process.env.NODE_ENV === 'test' ? 'localhost' : stringWithDefault('MONGO_HOST', 'nosql-db'),
    MONGO_DB_NAME: stringWithDefault('MONGO_DB_NAME', 'human_ressources'),

    JWT_SECRET: requireStringWithCIFallback('JWT_SECRET', 'ci-jwt-secret'),
    SESSION_SECRET: requireStringWithCIFallback('SESSION_SECRET', 'ci-session-secret'),

    GOOGLE_CLIENT_ID: optionalString('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalString('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: stringWithDefault('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google'),

    SMTP_HOST: optionalString('SMTP_HOST'),
    SMTP_PORT: numberWithDefault('SMTP_PORT', 587),
    SMTP_SECURE: optionalString('SMTP_SECURE'),
    SMTP_USER: optionalString('SMTP_USER'),
    SMTP_PASS: optionalString('SMTP_PASS'),
    SMTP_FROM: optionalString('SMTP_FROM'),

    FILIZ_CLIENT_ID: requireStringWithCIFallback('FILIZ_CLIENT_ID', 'ci-filiz-client-id'),
    FILIZ_CLIENT_SECRET: requireStringWithCIFallback('FILIZ_CLIENT_SECRET', 'ci-filiz-secret'),
    FILIZ_AUDIENCE: requireStringWithCIFallback('FILIZ_AUDIENCE', 'ci-filiz-audience'),
    FILIZ_BASE_URI: optionalString('FILIZ_BASE_URI', 'https://api.dev.partners.filiz.io'),
    FILIZ_AUTH_URI: requireStringWithCIFallback('FILIZ_AUTH_URI', 'http://localhost/ci-filiz-auth'),

    INSEE_API_KEY: optionalString('INSEE_API_KEY'),

    YOUSIGN_API_KEY: optionalString('YOUSIGN_API_KEY', 'sandbox_yousign_key_placeholder'),
    YOUSIGN_BASE_URL: stringWithDefault('YOUSIGN_BASE_URL', 'https://api-sandbox.yousign.app/v3'),
    YOUSIGN_WEBHOOK_SECRET: optionalString('YOUSIGN_WEBHOOK_SECRET'),

    // DocuSeal e-signature. Override base URL with https://api.docuseal.eu (EU)
    // or a self-hosted instance URL as needed.
    DOCUSEAL_API_KEY: optionalString('DOCUSEAL_API_KEY', 'docuseal_key_placeholder'),
    DOCUSEAL_BASE_URL: stringWithDefault('DOCUSEAL_BASE_URL', 'https://api.docuseal.com'),
    DOCUSEAL_WEBHOOK_SECRET: optionalString('DOCUSEAL_WEBHOOK_SECRET'),

    OLLAMA_BASE_URL: stringWithDefault('OLLAMA_BASE_URL', 'http://localhost:11434'),

    // Gemini AI Studio (generativelanguage API) — clé API gratuite pour résumés candidats.
    GEMINI_API_KEY: optionalString('GEMINI_API'),
    GEMINI_MODEL: stringWithDefault('GEMINI_MODEL', 'gemini-2.0-flash'),
    GEMINI_BASE_URL: stringWithDefault('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),

    // Dossier partagé racine "Candidat Nord" (fallback si pas de sous-dossier par TP).
    DRIVE_CANDIDATS_NORD_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_FOLDER_ID'),
    // Sous-dossiers par type de Titre Professionnel, dans "Candidat Nord".
    DRIVE_CANDIDATS_NORD_AD_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_AD_FOLDER_ID'),
    DRIVE_CANDIDATS_NORD_CC_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_CC_FOLDER_ID'),
    DRIVE_CANDIDATS_NORD_NTC_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_NTC_FOLDER_ID'),
    DRIVE_CANDIDATS_NORD_REM_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_REM_FOLDER_ID'),
    DRIVE_CANDIDATS_NORD_SA_FOLDER_ID: optionalString('DRIVE_CANDIDATS_NORD_SA_FOLDER_ID'),

    // Dossier Drive où sont stockés les pièces jointes / signatures des modèles de mail.
    DRIVE_TEMPLATES_FOLDER_ID: optionalString('DRIVE_TEMPLATES_FOLDER_ID'),

    OAUTH_ENCRYPTION_KEY: requireString('OAUTH_ENCRYPTION_KEY'),
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

if (INSECURE_DEFAULTS.has(data.RELANCE_HMAC_SECRET)) {
    console.error('RELANCE_HMAC_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (INSECURE_DEFAULTS.has(data.GOOGLE_STATE_SECRET)) {
    console.error('GOOGLE_STATE_SECRET is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (INSECURE_DEFAULTS.has(data.OAUTH_ENCRYPTION_KEY)) {
    console.error('OAUTH_ENCRYPTION_KEY is set to an insecure default value. Change it before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (data.NODE_ENV === 'production' && !data.MONGO_URI) {
    console.error('MONGO_URI is required in production');
    process.exit(1);
}

if (data.NODE_ENV === 'production' && !data.MYSQL_URI) {
    console.error('MYSQL_URI is required in production');
    process.exit(1);
}

export const env = data;
