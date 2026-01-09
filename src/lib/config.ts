/**
 * Environment-aware configuration for the application.
 * Automatically detects and configures based on VITE_ENVIRONMENT.
 */

export type Environment = 'development' | 'staging' | 'production';

export interface Config {
  /** Current environment */
  environment: Environment;
  /** Supabase API URL */
  supabaseUrl: string;
  /** Supabase anonymous key */
  supabaseAnonKey: string;
  /** Supabase project ID */
  supabaseProjectId: string;
  /** Whether running on localhost */
  isLocal: boolean;
  /** Whether this is the production environment */
  isProduction: boolean;
  /** Whether this is a development environment */
  isDevelopment: boolean;
}

// Production defaults (Supabase Cloud)
const PROD_SUPABASE_URL = 'https://wevdjmdlsrljanttykzu.supabase.co';
const PROD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldmRqbWRsc3JsamFudHR5a3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDI3NTEsImV4cCI6MjA4MTkxODc1MX0.kucbr1-8eeMmrJPx4TFn2TMtNfl2e0EA7MkiXskOvlI';
const PROD_PROJECT_ID = 'wevdjmdlsrljanttykzu';

/**
 * Get environment from VITE_ENVIRONMENT or detect from URL
 */
function detectEnvironment(): Environment {
  // Check explicit environment variable first
  const envVar = import.meta.env.VITE_ENVIRONMENT;
  if (envVar === 'development' || envVar === 'staging' || envVar === 'production') {
    return envVar;
  }

  // Auto-detect from Supabase URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (supabaseUrl.includes('localhost')) {
    return 'development';
  }
  if (supabaseUrl.includes('staging') || supabaseUrl.includes('qa.')) {
    return 'staging';
  }

  // Default to production
  return 'production';
}

/**
 * Application configuration based on environment
 */
export const config: Config = (() => {
  const environment = detectEnvironment();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROD_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PROD_SUPABASE_ANON_KEY;
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || PROD_PROJECT_ID;

  return {
    environment,
    supabaseUrl,
    supabaseAnonKey,
    supabaseProjectId,
    isLocal: supabaseUrl.includes('localhost'),
    isProduction: environment === 'production',
    isDevelopment: environment === 'development',
  };
})();

/**
 * Log current configuration (only in development)
 */
if (config.isDevelopment) {
  console.log('[Config] Environment:', config.environment);
  console.log('[Config] Supabase URL:', config.supabaseUrl);
  console.log('[Config] Is Local:', config.isLocal);
}
