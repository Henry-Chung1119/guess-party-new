import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticatePlayer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { token, roundId, choice } = await req.json();
    if (typeof choice !== 'boolean') {
      return NextResponse.json({ error: '投票選項無效' }, { status: 400 });
    }

    const { player, room } = await authenticatePlayer(token);
    if (room.status !== 'VOTING') {
      return NextResponse.json({ error: '非投票階段' }, { status: 400 });
    }

    const { error: voteErr } = await supabaseAdmin.from('votes').insert({
      round_id: roundId,
      player_id: player.id,
      choice,
    });

    if (voteErr) {
      return NextResponse.json({ error: '你已經投過票，不可重複投票' }, { status: 400 });
    }

    const [{ count: totalPlayers }, { count: totalVotes }] = await Promise.all([
      supabaseAdmin.from('players').select('*', { count: 'exact', head: true }).eq('room_id', room.id),
      supabaseAdmin.from('votes').select('*', { count: 'exact', head: true }).eq('round_id', roundId),
    ]);

    if (totalPlayers && totalVotes && totalVotes >= totalPlayers) {
      await supabaseAdmin.from('rooms').update({ status: 'GUESSING' }).eq('id', room.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}