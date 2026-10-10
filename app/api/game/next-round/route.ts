import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticatePlayer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const { player, room } = await authenticatePlayer(token);

    if (room.host_id !== player.id) {
      return NextResponse.json({ error: '只有房主可以開啟下一輪' }, { status: 403 });
    }

    if (room.status !== 'RESULT') {
      return NextResponse.json({ error: '當前回合尚未結束' }, { status: 400 });
    }

    const { data: players } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .order('join_order', { ascending: true });

    if (!players || players.length === 0) {
      return NextResponse.json({ error: '房間內無玩家' }, { status: 400 });
    }

    const nextRoundNumber = room.current_round + 1;
    const nextAskerIndex = (nextRoundNumber - 1) % players.length;
    const nextAsker = players[nextAskerIndex];

    const { data: newRound, error: rErr } = await supabaseAdmin
      .from('rounds')
      .insert({
        room_id: room.id,
        round_number: nextRoundNumber,
        asker_id: nextAsker.id,
      })
      .select()
      .single();

    if (rErr || !newRound) {
      return NextResponse.json({ error: '建立新回合失敗' }, { status: 500 });
    }

    await supabaseAdmin
      .from('rooms')
      .update({
        status: 'QUESTIONING',
        current_round: nextRoundNumber,
      })
      .eq('id', room.id);

    return NextResponse.json({ success: true, roundId: newRound.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}