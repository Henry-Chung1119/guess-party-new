import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticatePlayer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const { player, room } = await authenticatePlayer(token);

    if (room.host_id !== player.id) {
      return NextResponse.json({ error: '只有房主可以開始遊戲' }, { status: 403 });
    }

    if (room.status !== 'LOBBY') {
      return NextResponse.json({ error: '遊戲已在進行中' }, { status: 400 });
    }

    const { data: players } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .order('join_order', { ascending: true });

    if (!players || players.length < 3) {
      return NextResponse.json({ error: '人數不足，至少需 3 位玩家' }, { status: 400 });
    }

    const firstAsker = players[0];

    const { data: round, error: roundErr } = await supabaseAdmin
      .from('rounds')
      .insert({
        room_id: room.id,
        round_number: 1,
        asker_id: firstAsker.id,
      })
      .select()
      .single();

    if (roundErr || !round) {
      return NextResponse.json({ error: '建立回合失敗' }, { status: 500 });
    }

    await supabaseAdmin
      .from('rooms')
      .update({ status: 'QUESTIONING', current_round: 1 })
      .eq('id', room.id);

    return NextResponse.json({ success: true, roundId: round.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}