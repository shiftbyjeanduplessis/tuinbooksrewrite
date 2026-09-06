const URL = 'https://rjtvgdyelqmvdosndhik.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_1u2eSdcCUd7L2BR7u-PAVQ_MLnStefE';

if (!window.supabase?.createClient) throw new Error('Supabase client library did not load.');

export const supabase: any = window.supabase.createClient(URL, PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
