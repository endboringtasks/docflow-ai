// Supabase client with environment-aware configuration
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { config } from '@/lib/config';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,

    // Use PKCE so email-link scanners can't "consume" magic links.
    // This makes magic links most reliable when opened on the same device/browser.
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});