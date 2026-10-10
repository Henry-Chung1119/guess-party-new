'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Room, Player, Round } from '@/lib/types';

export default function GameRoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const roomCode = params.code;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [myToken, setMyToken] = useState<string>('');
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);

  // 互動表單狀態
  const [questionText, setQuestionText] = useState('');
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [guesses, setGuesses] = useState<Record<string, boolean>>({});
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [myResult, setMyResult] = useState<boolean | null>(null);
  const [wrongCount, setWrongCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('guess_party_token');
    if (!token) {
      router.push('/');
      return;
    }
    setMyToken(token);
    loadRoomData(roomCode, token);
  }, [roomCode]);

  async function loadRoomData(code: string, token: string) {
    const { data: r, error } = await supabase.from('rooms').select('*').eq('code', code).single();
    if (error || !r) {
      alert('找不到房間');
      router.push('/');
      return;
    }
    setRoom(r);

    const { data: pList } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', r.id)
      .order('join_order', { ascending: true });

    if (pList) {
      setPlayers(pList);
      const me = pList.find(p => p.token === token);
      if (me) setMyPlayer(me);
    }

    loadRoundData(r.id, r.current_round);

    const channel = supabase
      .channel(`room_sync_${r.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${r.id}` }, (payload) => {
        const updatedRoom = payload.new as Room;
        setRoom(updatedRoom);
        if (updatedRoom.status === 'QUESTIONING') {
          setMyVote(null);
          setGuesses({});
          setGuessSubmitted(false);
          setMyResult(null);
          setWrongCount(null); // 新增這行
          setErrorMsg('');
        }
        loadRoundData(updatedRoom.id, updatedRoom.current_round);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${r.id}` }, () => {
        reloadPlayers(r.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${r.id}` }, (payload) => {
        setCurrentRound(payload.new as Round);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function reloadPlayers(roomId: string) {
    const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('join_order');
    if (data) setPlayers(data);
  }

  async function loadRoundData(roomId: string, roundNumber: number) {
    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('room_id', roomId)
      .eq('round_number', roundNumber)
      .maybeSingle();

    if (data) setCurrentRound(data);
  }

  useEffect(() => {
    if (room?.status === 'RESULT' && currentRound && myPlayer) {
      supabase
        .from('round_results')
        .select('is_all_correct')
        .eq('round_id', currentRound.id)
        .eq('player_id', myPlayer.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            // 加上型別宣告即可解決報錯
            const res = data as { is_all_correct: boolean; wrong_count?: number };
            setMyResult(res.is_all_correct);
            if (typeof res.wrong_count === 'number') {
              setWrongCount(res.wrong_count);
            }
          }
        });
    }
  }, [room?.status, currentRound, myPlayer]);

  // 取得結算結果（支援即時推送與讀取）
  useEffect(() => {
    if (room?.status !== 'RESULT' || !currentRound || !myPlayer) return;

    let timer: NodeJS.Timeout;

    const fetchResult = async () => {
      const { data, error } = await supabase
        .from('round_results')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('player_id', myPlayer.id)
        .maybeSingle();

      if (data) {
        const res = data as { is_all_correct: boolean; wrong_count?: number };
        setMyResult(res.is_all_correct);
        setWrongCount(res.wrong_count ?? 0);
      } else {
        // 如果還沒寫入完成，500 毫秒後重試一次
        timer = setTimeout(fetchResult, 500);
      }
    };

    fetchResult();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [room?.status, currentRound?.id, myPlayer?.id]);

  const handleStartGame = async () => {
    setErrorMsg('');
    const res = await fetch('/api/room/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: myToken }),
    });
    const d = await res.json();
    if (!res.ok) setErrorMsg(d.error);
  };

  const handleSubmitQuestion = async () => {
    if (!questionText.trim() || !currentRound) return;
    setErrorMsg('');
    const res = await fetch('/api/game/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: myToken, roundId: currentRound.id, question: questionText }),
    });
    const d = await res.json();
    if (!res.ok) setErrorMsg(d.error);
    else setQuestionText('');
  };

  const handleVote = async (choice: boolean) => {
    if (!currentRound) return;
    setErrorMsg('');
    setMyVote(choice);
    const res = await fetch('/api/game/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: myToken, roundId: currentRound.id, choice }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErrorMsg(d.error);
      setMyVote(null);
    }
  };

  const handleSubmitGuesses = async () => {
    if (!currentRound) return;
    setErrorMsg('');
    const guessPayload = Object.entries(guesses).map(([targetId, predictedChoice]) => ({
      targetId,
      predictedChoice,
    }));

    const res = await fetch('/api/game/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: myToken, roundId: currentRound.id, guesses: guessPayload }),
    });
    const d = await res.json();
    if (res.ok) {
      setGuessSubmitted(true);
    } else {
      setErrorMsg(d.error);
    }
  };

  const handleNextRound = async () => {
    setErrorMsg('');
    const res = await fetch('/api/game/next-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: myToken }),
    });
    const d = await res.json();
    if (!res.ok) setErrorMsg(d.error);
  };

  const copyInviteLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const otherPlayers = useMemo(() => {
    return players.filter(p => p.id !== myPlayer?.id);
  }, [players, myPlayer]);

  if (!room) {
    return <div className="p-8 text-center text-slate-500">正在進入房間...</div>;
  }

  const isHost = myPlayer?.id === room.host_id;
  const isCurrentAsker = currentRound?.asker_id === myPlayer?.id;
  const currentAskerPlayer = players.find(p => p.id === currentRound?.asker_id);

  return (
    <main className="w-full max-w-md min-h-screen p-5 flex flex-col justify-between">
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">房間代碼</span>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-indigo-400 tracking-widest font-mono">{room.code}</h2>
            <button
              onClick={copyInviteLink}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg text-slate-300 active:scale-95 transition"
            >
              {copied ? '已複製!' : '複製連結'}
            </button>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">回合</span>
          <p className="text-xl font-black text-white">第 {room.current_round} 輪</p>
        </div>
      </header>

      {errorMsg && (
        <div className="my-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl text-xs text-center">
          {errorMsg}
        </div>
      )}

      <section className="flex-1 my-5 flex flex-col justify-center">
        {room.status === 'LOBBY' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">等待玩家加入</h3>
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold">
                {players.length} / 12 人
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl text-sm font-medium flex items-center justify-between ${
                    p.id === myPlayer?.id ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="truncate">{p.nickname}</span>
                  {p.id === room.host_id && <span className="text-xs text-amber-400">👑 房主</span>}
                </div>
              ))}
            </div>

            {isHost ? (
              <button
                disabled={players.length < 3}
                onClick={handleStartGame}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 py-4 rounded-2xl font-bold transition shadow-lg shadow-indigo-600/30"
              >
                {players.length < 3 ? '至少需 3 位玩家方可開始' : '開始遊戲'}
              </button>
            ) : (
              <div className="text-center py-3 text-sm text-slate-400 animate-pulse">
                等待房主啟動遊戲...
              </div>
            )}
          </div>
        )}

        {room.status === 'QUESTIONING' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
            <div className="text-center space-y-1">
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">輪流出題</span>
              <h3 className="text-xl font-black text-white">
                出題者：{currentAskerPlayer?.nickname || '載入中'}
              </h3>
            </div>

            {isCurrentAsker ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 text-center">
                  請輸入一個大家只能回答「是」或「否」的趣味是非題：
                </p>
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="例如：你曾經在洗澡時偷偷唱歌被發現過嗎？"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSubmitQuestion}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition"
                >
                  確認發布題目
                </button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="inline-block animate-spin text-2xl">⏳</div>
                <p className="text-slate-400 text-sm">
                  {currentAskerPlayer?.nickname} 正在思考題目中，請稍候...
                </p>
              </div>
            )}
          </div>
        )}

        {room.status === 'VOTING' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl text-center space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full">
                當前題目
              </span>
              <h3 className="text-2xl font-extrabold text-white leading-snug">
                {currentRound?.question}
              </h3>
            </div>

            {myVote === null ? (
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  onClick={() => handleVote(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-6 rounded-2xl text-2xl font-black transition shadow-lg shadow-emerald-600/30"
                >
                  是 👍
                </button>
                <button
                  onClick={() => handleVote(false)}
                  className="bg-rose-600 hover:bg-rose-500 active:scale-95 py-6 rounded-2xl text-2xl font-black transition shadow-lg shadow-rose-600/30"
                >
                  否 👎
                </button>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-2">
                <p className="text-emerald-400 font-bold">已成功送出匿名投票！</p>
                <p className="text-xs text-slate-500">
                  其他玩家投票中，所有人都投完後將自動進入猜測階段...
                </p>
              </div>
            )}
          </div>
        )}

        {room.status === 'GUESSING' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold">題目回顧</span>
              <p className="text-sm font-semibold text-white truncate">{currentRound?.question}</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-indigo-300 font-medium">請猜測每位玩家投的是「是」還是「否」：</p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {otherPlayers.map((target) => (
                  <div
                    key={target.id}
                    className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800"
                  >
                    <span className="text-sm font-bold text-slate-200">{target.nickname}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGuesses(prev => ({ ...prev, [target.id]: true }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          guesses[target.id] === true
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        是
                      </button>
                      <button
                        onClick={() => setGuesses(prev => ({ ...prev, [target.id]: false }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          guesses[target.id] === false
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        否
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!guessSubmitted ? (
              <button
                disabled={Object.keys(guesses).length !== otherPlayers.length}
                onClick={handleSubmitGuesses}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition"
              >
                {Object.keys(guesses).length !== otherPlayers.length
                  ? `尚有 ${otherPlayers.length - Object.keys(guesses).length} 人未猜測`
                  : '提交猜測結果'}
              </button>
            ) : (
              <div className="text-center py-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400">
                已成功提交猜測！等待所有人完成提交...
              </div>
            )}
          </div>
        )}

{room.status === 'RESULT' && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl text-center space-y-6">
            {myResult === true ? (
              <div className="space-y-3">
                <span className="text-6xl animate-bounce inline-block">🎉</span>
                <h3 className="text-2xl font-black text-emerald-400">
                  恭喜！你全部猜對了！
                </h3>
                <p className="text-xs text-slate-400">你完全看透了現場所有人的心思！</p>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-6xl inline-block">🙈</span>
                <h3 className="text-2xl font-black text-rose-400">
                  很可惜，這次沒有全部猜對。
                </h3>
                {wrongCount !== null && (
                  <div className="bg-slate-950/80 border border-rose-500/20 py-3 px-4 rounded-2xl inline-block my-2">
                    <p className="text-sm text-slate-300">
                      你這輪猜錯了 <span className="text-rose-400 font-black text-xl">{wrongCount}</span> 個人！
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-400">誰投了什麼依然保密，下輪再試一次！</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800">
              {isHost ? (
                <button
                  onClick={handleNextRound}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold transition shadow-lg shadow-indigo-600/30 active:scale-[0.98]"
                >
                  換下一位出題（進入第 {room.current_round + 1} 輪）
                </button>
              ) : (
                <p className="text-xs text-slate-500 animate-pulse">
                  等待房主開啟下一輪遊戲...
                </p>
              )}
            </div>
          </div>
        )}

      </section>

      <footer className="text-center text-[11px] text-slate-500">
        若在微信內，點選右上角「···」即可將此網頁分享給朋友
      </footer>
    </main>
  );
}