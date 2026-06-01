import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export async function getActiveRoom(): Promise<{ id: string; code: string; status: string } | null> {
  const { data } = await supabase
    .from('rooms')
    .select('id, code, status')
    .in('status', ['playing', 'waiting'])
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}
