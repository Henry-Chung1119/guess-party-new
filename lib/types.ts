export type RoomStatus = 'LOBBY' | 'QUESTIONING' | 'VOTING' | 'GUESSING' | 'RESULT';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: room_status | RoomStatus;
  current_round: number;
  created_at: string;
}

export type room_status = RoomStatus;

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  token: string;
  join_order: number;
  is_ready: boolean;
  created_at: string;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  asker_id: string;
  question: string | null;
  created_at: string;
}

export interface RoundResult {
  id: string;
  round_id: string;
  player_id: string;
  is_all_correct: boolean;
}

export interface RoundResult {
  id: string;
  round_id: string;
  player_id: string;
  is_all_correct: boolean;
  wrong_count: number; // 新增這行
}