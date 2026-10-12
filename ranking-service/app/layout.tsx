import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ぐんぐん ヘビの庭 ランキング",
  description: "ぐんぐん ヘビの庭の難易度別共有ランキング。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
