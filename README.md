# 猜猜看 Party (Guess Party)

多人匿名投票與社交猜測推理遊戲（支援 3–12 人）。
基於 **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase + Vercel**。

## 快速開始

1. 安裝相依套件：
```bash
npm install
```

2. 設定資料庫：
- 至 [Supabase](https://supabase.com) 建立專案。
- 在 **SQL Editor** 執行專案目錄下的 `schema.sql`。
- 複製 `.env.example` 為 `.env.local` 並填入 Supabase URL 及金鑰：
```bash
cp .env.example .env.local
```

3. 本地啟動：
```bash
npm run dev
```
開啟瀏覽器連線至 `http://localhost:3000`。

4. 部署至 Vercel：
- 推送程式碼至 GitHub。
- 在 Vercel 匯入專案，並設定環境變數 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 即可自動部署。
