import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticatePlayer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { token, roundId, guesses } = await req.json() as {
      token: string;
      roundId: string;
      guesses: { targetId: string; predictedChoice: boolean }[];
    };

    const { player, room } = await authenticatePlayer(token);
    if (room.status !== 'GUESSING') {
      return NextResponse.json({ error: '非猜測階段' }, { status: 400 });
    }

    const { data: allPlayers } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('room_id', room.id);

    const otherPlayers = (allPlayers || []).filter(p => p.id !== player.id);
    if (!guesses || guesses.length !== otherPlayers.length) {
      return NextResponse.json({ error: '必須猜測所有其他人的答案' }, { status: 400 });
    }

    const guessRows = guesses.map(g => ({
      round_id: roundId,
      guesser_id: player.id,
      target_id: g.targetId,
      predicted_choice: g.predictedChoice,
    }));

    const { error: gErr } = await supabaseAdmin.from('guesses').insert(guessRows);
    if (gErr) {
      return NextResponse.json({ error: '不可重複提交猜測' }, { status: 400 });
    }

    // 後端內部進行答案比對（零知識驗證，不返回細節）
    const { data: actualVotes } = await supabaseAdmin
      .from('votes')
      .select('player_id, choice')
      .eq('round_id', roundId)
      .in('player_id', otherPlayers.map(p => p.id));

    const actualMap = new Map((actualVotes || []).map(v => [v.player_id, v.choice]));

    // 計算錯誤數量
    const wrongCount = guesses.reduce((count, g) => {
      return actualMap.get(g.targetId) !== g.predictedChoice ? count + 1 : count;
    }, 0);

    const isAllCorrect = wrongCount === 0;

    await supabaseAdmin.from('round_results').insert({
      round_id: roundId,
      player_id: player.id,
      is_all_correct: isAllCorrect,
      wrong_count: wrongCount, // 新增儲存錯誤數量
    });

    const [{ count: totalPlayers }, { count: totalResults }] = await Promise.all([
      supabaseAdmin.from('players').select('*', { count: 'exact', head: true }).eq('room_id', room.id),
      supabaseAdmin.from('round_results').select('*', { count: 'exact', head: true }).eq('round_id', roundId),
    ]);

    if (totalPlayers && totalResults && totalResults >= totalPlayers) {
      await supabaseAdmin.from('rooms').update({ status: 'RESULT' }).eq('id', room.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}