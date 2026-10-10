-- 1. 建立房間狀態列舉
CREATE TYPE room_status AS ENUM ('LOBBY', 'QUESTIONING', 'VOTING', 'GUESSING', 'RESULT');

-- 2. 房間表
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  status room_status NOT NULL DEFAULT 'LOBBY',
  current_round INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 玩家表
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname VARCHAR(20) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  join_order INT NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 回合表
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  asker_id UUID NOT NULL REFERENCES players(id),
  question TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, round_number)
);

-- 5. 匿名投票表（核心安全防護）
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  choice BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, player_id)
);

-- 6. 猜測記錄表
CREATE TABLE guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  guesser_id UUID NOT NULL REFERENCES players(id),
  target_id UUID NOT NULL REFERENCES players(id),
  predicted_choice BOOLEAN NOT NULL,
  UNIQUE(round_id, guesser_id, target_id)
);

-- 7. 結算結果表（只存二元結果）
CREATE TABLE round_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  is_all_correct BOOLEAN NOT NULL,
  UNIQUE(round_id, player_id)
);

-- 8. 安全權限設定 (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Allow public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Allow public read round_results" ON round_results FOR SELECT USING (true);

-- 關鍵：徹底禁止前端直接讀取 votes 表，防作弊
CREATE POLICY "Deny all reads on votes" ON votes FOR SELECT USING (false);

-- 9. 即時同步設定 (Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE round_results;