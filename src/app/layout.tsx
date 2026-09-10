import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "어프라임 동아리실 예약 시스템",
  description: "빠르고 간편한 동아리실 예약 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col items-center bg-gray-50 dark:bg-slate-900">
        <main className="w-full max-w-md min-h-screen bg-white dark:bg-slate-800 shadow-md">
          {children}
        </main>
      </body>
    </html>
  );
}
