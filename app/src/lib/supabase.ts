import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null when the app is built without Supabase env vars — everything then stays local-only. */
export const supabase = url && key ? createClient(url, key, { auth: { storageKey: 'tubify:auth', persistSession: true, autoRefreshToken: true } }) : null;
