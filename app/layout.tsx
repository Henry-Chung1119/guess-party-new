import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "猜猜看：多人匿名投票猜測遊戲",
  description: "刺激好玩的多人派對推理遊戲",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-slate-950 flex flex-col items-center justify-start antialiased">
        {children}
      </body>
    </html>
  );
}