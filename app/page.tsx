'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'HOME' | 'JOIN'>('HOME');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setErrorMsg('請先輸入你的暱稱');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('guess_party_token', data.token);
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomCode.trim()) {
      setErrorMsg('請輸入暱稱與 6 位數房間碼');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('guess_party_token', data.token);
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-md p-6 flex flex-col min-h-screen justify-between">
      <div className="pt-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          猜猜看 <span className="text-indigo-500">Party</span>
        </h1>
        <p className="text-slate-400 text-sm">多人匿名投票與社交猜測遊戲</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-5">
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl text-sm text-center">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">你的遊戲暱稱</label>
          <input
            type="text"
            maxLength={15}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例如：派對大王"
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {mode === 'HOME' ? (
          <div className="space-y-3 pt-2">
            <button
              disabled={loading}
              onClick={handleCreateRoom}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] py-4 rounded-2xl font-bold text-white transition shadow-lg shadow-indigo-600/30"
            >
              建立新房間
            </button>
            <button
              onClick={() => { setErrorMsg(''); setMode('JOIN'); }}
              className="w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.98] py-4 rounded-2xl font-bold text-slate-200 transition"
            >
              輸入房間碼加入
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">6 位數房間碼</label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                placeholder="例如：839201"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-center text-2xl tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              disabled={loading}
              onClick={handleJoinRoom}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] py-4 rounded-2xl font-bold text-white transition shadow-lg shadow-emerald-600/30"
            >
              立即加入
            </button>
            <button
              onClick={() => { setErrorMsg(''); setMode('HOME'); }}
              className="w-full bg-transparent py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              返回上一頁
            </button>
          </div>
        )}
      </div>

      <div className="pb-6 text-center text-xs text-slate-600">
        支援 3–12 人同樂 • 絕對匿名保護
      </div>
    </main>
  );
}