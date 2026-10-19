import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const hasConfiguration = Boolean(projectUrl && publishableKey);

let client: SupabaseClient | null = null;
if (hasConfiguration) {
  try {
    client = createClient(projectUrl!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    client = null;
  }
}

export const supabase = client;
export const supabaseConfigured = Boolean(client);
