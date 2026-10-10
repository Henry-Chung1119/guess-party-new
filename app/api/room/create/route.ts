import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { nickname } = await req.json();
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json({ error: '請輸入有效的暱稱' }, { status: 400 });
    }

    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hostToken = crypto.randomBytes(32).toString('hex');
    const tempHostId = crypto.randomUUID();

    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .insert({
        code: roomCode,
        host_id: tempHostId,
        status: 'LOBBY',
        current_round: 1,
      })
      .select()
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: '房間建立失敗' }, { status: 500 });
    }

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .insert({
        id: tempHostId,
        room_id: room.id,
        nickname: nickname.trim().slice(0, 15),
        token: hostToken,
        join_order: 1,
        is_ready: true,
      })
      .select()
      .single();

    if (playerErr || !player) {
      return NextResponse.json({ error: '房主註冊失敗' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roomCode: room.code,
      token: hostToken,
      playerId: player.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}