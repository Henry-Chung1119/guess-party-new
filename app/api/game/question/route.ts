import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticatePlayer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { token, roundId, question } = await req.json();
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: '請輸入題目' }, { status: 400 });
    }

    const { player, room } = await authenticatePlayer(token);
    if (room.status !== 'QUESTIONING') {
      return NextResponse.json({ error: '當前不是出題階段' }, { status: 400 });
    }

    const { data: round } = await supabaseAdmin
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (!round || round.asker_id !== player.id) {
      return NextResponse.json({ error: '你不是本回合的出題者' }, { status: 403 });
    }

    await supabaseAdmin
      .from('rounds')
      .update({ question: question.trim() })
      .eq('id', roundId);

    await supabaseAdmin
      .from('rooms')
      .update({ status: 'VOTING' })
      .eq('id', room.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}