import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env?.VITE_SUPABASE_URL  ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key  = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url === 'your_supabase_project_url') {
  console.warn('[Supabase] URL not set — running in local-only mode');
}

export const supabase = createClient(url ?? '', key ?? '');
