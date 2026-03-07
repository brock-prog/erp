// server/src/config.ts — Environment variable validation and typed config

import dotenv from 'dotenv';
dotenv.config();  // Load .env file into process.env

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),

  // Auth
  jwtSecret: optionalEnv('JWT_SECRET', 'change-this-in-production-jwt-secret-minimum-32-chars'),
  jwtRefreshSecret: optionalEnv('JWT_REFRESH_SECRET', 'change-this-in-production-refresh-secret-min-32'),
  jwtExpiresIn: '15m',        // Access token lifetime
  jwtRefreshExpiresIn: 30,    // Refresh token lifetime in days

  // ADP Workforce Now (server-side only — never exposed to browser)
  adp: {
    clientId: optionalEnv('ADP_CLIENT_ID', ''),
    clientSecret: optionalEnv('ADP_CLIENT_SECRET', ''),
    environment: optionalEnv('ADP_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production',
    isConfigured: !!(process.env.ADP_CLIENT_ID && process.env.ADP_CLIENT_SECRET),
  },

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Supabase (for server-side backup — uses service role key to bypass RLS)
  supabase: {
    url: optionalEnv('SUPABASE_URL', ''),
    serviceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
    isConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  // Backup
  backup: {
    dir: optionalEnv('BACKUP_DIR', './backups'),
    cronSchedule: optionalEnv('BACKUP_CRON', '0 */6 * * *'),  // Every 6 hours
    maxBackups: parseInt(optionalEnv('BACKUP_MAX_COUNT', '120'), 10),  // 30 days × 4/day
    enabled: optionalEnv('BACKUP_ENABLED', 'true') === 'true',
  },

  // Sentry (optional)
  sentryDsn: optionalEnv('SENTRY_DSN', ''),
} as const;

// Validate required vars in production
if (config.nodeEnv === 'production') {
  requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET');
  requireEnv('JWT_REFRESH_SECRET');
  requireEnv('FRONTEND_URL');
}

export type Config = typeof config;
