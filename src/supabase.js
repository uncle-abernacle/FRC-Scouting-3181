import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

export const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
export const SUPABASE_ANON_KEY = "sb_publishable_vAZ5IRxNagHokySDfMHgUw_jOHtLT-X";

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://")
  && (SUPABASE_ANON_KEY.startsWith("ey") || SUPABASE_ANON_KEY.startsWith("sb_publishable_"));

export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
