// src/lib/supabase.ts — Supabase client (singleton)
// All app data is persisted here; localStorage is an offline fallback only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const configured = !!(supabaseUrl && supabaseAnon &&
  !supabaseUrl.includes('your-project-ref') &&
  !supabaseAnon.includes('your-anon-public-key'));

export const supabase: SupabaseClient | null = configured
  ? createClient(supabaseUrl!, supabaseAnon!)
  : null;

if (!configured) {
  console.info(
    '[Supabase] Not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.\n' +
    'Data will persist to localStorage only until credentials are provided.'
  );
}

export const isSupabaseReady = configured;
