import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export async function authenticatePlayer(token: string) {
  if (!token) throw new Error('未提供玩家識別 Token');

  const { data: player, error: pErr } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('token', token)
    .single();

  if (pErr || !player) throw new Error('玩家不存在或識別無效');

  const { data: room, error: rErr } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('id', player.room_id)
    .single();

  if (rErr || !room) throw new Error('房間不存在');

  return { player, room };
}