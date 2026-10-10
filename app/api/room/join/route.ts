import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { code, nickname } = await req.json();
    if (!code || !nickname) {
      return NextResponse.json({ error: '請輸入房間碼與暱稱' }, { status: 400 });
    }

    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', code.trim())
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: '找不到該房間碼' }, { status: 404 });
    }

    if (room.status !== 'LOBBY') {
      return NextResponse.json({ error: '遊戲已經開始，無法加入' }, { status: 400 });
    }

    const { count } = await supabaseAdmin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (count && count >= 12) {
      return NextResponse.json({ error: '房間已滿 (上限 12 人)' }, { status: 400 });
    }

    const playerToken = crypto.randomBytes(32).toString('hex');
    const joinOrder = (count || 0) + 1;

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .insert({
        room_id: room.id,
        nickname: nickname.trim().slice(0, 15),
        token: playerToken,
        join_order: joinOrder,
        is_ready: true,
      })
      .select()
      .single();

    if (playerErr || !player) {
      return NextResponse.json({ error: '加入房間失敗' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roomCode: room.code,
      token: playerToken,
      playerId: player.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}