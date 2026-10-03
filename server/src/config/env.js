import crypto from 'node:crypto';
import { z } from 'zod';

/**
 * Centralised, validated configuration.
 * Every value comes from environment variables; nothing secret is hardcoded.
 * In production the process refuses to start when a required secret is missing.
 */

const toBool = (fallback) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }, z.boolean());

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional()
);

const emptyToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

/** This project's deployed frontend (Vercel production domain). Not a secret. */
const PRODUCTION_CLIENT_URL = 'https://real-time-chat-collaboration-applic.vercel.app';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_NAME: z.string().default('Nebula Chat'),

  MONGODB_URI: optionalString,
  MONGODB_DB_NAME: optionalString,

  JWT_ACCESS_SECRET: optionalString,
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(15),

  CLIENT_URL: z.preprocess(emptyToUndefined, z.string().url().default(isProd ? PRODUCTION_CLIENT_URL : 'http://localhost:5173')),
  CORS_ORIGINS: z.string().default(''),
  // Allowed frontend origins, comma separated. An entry without "*" must match exactly; "*" matches
  // letters, digits and dashes (never a dot). The default allows this project's Vercel production
  // domain exactly, plus its deployment/preview URLs. Set to "none" to disable.
  CORS_ORIGIN_PATTERNS: z.preprocess(
    emptyToUndefined,
    z.string().default(`${PRODUCTION_CLIENT_URL},https://real-time-chat-collaboration-application*.vercel.app`)
  ),
  COOKIE_SECURE: toBool(isProd),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.string().default(isProd ? '1' : 'false'),

  STORAGE_DRIVER: z.enum(['auto', 'cloudinary', 'local', 'disabled']).default('auto'),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z.string().default('nebula-chat'),
  PUBLIC_SERVER_URL: optionalString,
  MAX_FILE_SIZE_MB: z.coerce.number().positive().max(100).default(10),
  MAX_FILES_PER_MESSAGE: z.coerce.number().int().min(1).max(10).default(5),

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: toBool(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: z.string().default('Nebula Chat <no-reply@example.com>'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(240).default(30),

  DEMO_MODE: toBool(!isProd),
  DEMO_USER1_EMAIL: z.string().email().default('aarav.demo@example.com'),
  DEMO_USER2_EMAIL: z.string().email().default('maya.demo@example.com'),
  DEMO_USER3_EMAIL: z.string().email().default('liam.demo@example.com'),
  DEMO_ADMIN_EMAIL: z.string().email().default('admin.demo@example.com'),
  // Public demo credentials (shown on the sign-in page), one per account. Stored hashed with bcrypt.
  DEMO_USER1_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).default('DemoUser1@2026')),
  DEMO_USER2_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).default('DemoUser2@2026')),
  DEMO_USER3_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).default('DemoUser3@2026')),
  DEMO_ADMIN_PASSWORD: optionalString,
  DEMO_SEED_SAMPLE_DATA: toBool(true),
  DEMO_SHOW_CREDENTIALS: toBool(true),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(isProd ? 'info' : 'debug'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n[config] Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const env = parsed.data;
const productionErrors = [];

if (env.NODE_ENV === 'production') {
  if (!env.MONGODB_URI) productionErrors.push('MONGODB_URI is required in production.');
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32)
    productionErrors.push('JWT_ACCESS_SECRET must be set to at least 32 random characters in production.');
}

if (productionErrors.length) {
  console.error(`\n[config] Missing production configuration:\n  - ${productionErrors.join('\n  - ')}\n`);
  process.exit(1);
}

let accessSecret = env.JWT_ACCESS_SECRET;
let accessSecretGenerated = false;
if (!accessSecret || accessSecret.length < 32) {
  // Development convenience only: a per-process secret. Access tokens are short-lived and the
  // client silently refreshes them, so a restart never logs anybody out.
  accessSecret = crypto.randomBytes(48).toString('hex');
  accessSecretGenerated = true;
}

const parseTrustProxy = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // e.g. "loopback, 10.0.0.0/8"
};

const corsOrigins = Array.from(
  new Set(
    [env.CLIENT_URL, ...env.CORS_ORIGINS.split(',')]
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  )
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "https://my-app*.vercel.app" → /^https:\/\/my-app[a-z0-9-]*\.vercel\.app$/i */
const toOriginPattern = (pattern) =>
  new RegExp(`^${pattern.replace(/\/$/, '').split('*').map(escapeRegExp).join('[a-z0-9-]*')}$`, 'i');

const corsOriginPatterns =
  env.CORS_ORIGIN_PATTERNS.trim().toLowerCase() === 'none'
    ? []
    : env.CORS_ORIGIN_PATTERNS.split(',')
        .map((pattern) => pattern.trim())
        .filter(Boolean)
        .map(toOriginPattern);

// Cloudinary is enabled only when all three credentials are present.
const cloudinaryVars = {
  CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
};
const missingCloudinaryVars = Object.keys(cloudinaryVars).filter((name) => !cloudinaryVars[name]);
const hasCloudinary = missingCloudinaryVars.length === 0;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  appName: env.APP_NAME,
  logLevel: env.LOG_LEVEL,

  db: {
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB_NAME,
  },

  jwt: {
    accessSecret,
    accessSecretGenerated,
    accessTtl: env.ACCESS_TOKEN_TTL,
    issuer: 'nebula-chat',
  },

  refresh: {
    ttlDays: env.REFRESH_TOKEN_TTL_DAYS,
    reuseGraceSeconds: env.REFRESH_REUSE_GRACE_SECONDS,
    cookieName: 'nebula_rt',
    cookiePath: '/api/auth',
    cookieSecure: env.COOKIE_SECURE,
    cookieSameSite: env.COOKIE_SAMESITE,
  },

  clientUrl: env.CLIENT_URL.replace(/\/$/, ''),
  corsOrigins,
  corsOriginPatterns,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),

  storage: {
    driver: env.STORAGE_DRIVER,
    hasCloudinary,
    // Names (never values) of the Cloudinary variables still missing, for helpful startup logs.
    missingCloudinaryVars,
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      folder: env.CLOUDINARY_FOLDER,
    },
    publicServerUrl: env.PUBLIC_SERVER_URL?.replace(/\/$/, ''),
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
    maxFilesPerMessage: env.MAX_FILES_PER_MESSAGE,
    maxAvatarSizeMB: Math.min(5, env.MAX_FILE_SIZE_MB),
  },

  mail: {
    configured: Boolean(env.SMTP_HOST),
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
    resetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  },

  demo: {
    enabled: env.DEMO_MODE,
    seedSampleData: env.DEMO_SEED_SAMPLE_DATA,
    // Show the demo emails + passwords on the sign-in page (only ever applies while DEMO_MODE is on).
    // Only the DEMO_USER1..3_PASSWORD / DEMO_ADMIN_PASSWORD values are ever published — never other secrets.
    showCredentials: env.DEMO_SHOW_CREDENTIALS,
    accounts: [
      {
        key: 'user1',
        label: 'Demo User 1',
        role: 'user',
        fullName: 'Aarav Sharma',
        username: 'aarav',
        email: env.DEMO_USER1_EMAIL.toLowerCase(),
        password: env.DEMO_USER1_PASSWORD,
        bio: 'Product designer. Coffee, typography and late-night shipping.',
      },
      {
        key: 'user2',
        label: 'Demo User 2',
        role: 'user',
        fullName: 'Maya Chen',
        username: 'maya',
        email: env.DEMO_USER2_EMAIL.toLowerCase(),
        password: env.DEMO_USER2_PASSWORD,
        bio: 'Frontend engineer who loves fast UIs and faster feedback loops.',
      },
      {
        key: 'user3',
        label: 'Demo User 3',
        role: 'user',
        fullName: 'Liam Carter',
        username: 'liam',
        email: env.DEMO_USER3_EMAIL.toLowerCase(),
        password: env.DEMO_USER3_PASSWORD,
        bio: 'Backend & infra. Ask me about sockets.',
      },
      {
        key: 'admin',
        label: 'Demo Admin',
        role: 'admin',
        fullName: 'Nova Admin',
        username: 'admin',
        email: env.DEMO_ADMIN_EMAIL.toLowerCase(),
        password: env.DEMO_ADMIN_PASSWORD,
        bio: 'Keeping the workspace safe and healthy.',
      },
    ],
  },
};
