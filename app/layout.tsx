import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "./_components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Logistics AI Dashboard",
  description:
    "AI-powered analytics dashboard for logistics: KPIs, charts, natural-language queries, and demand forecasting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <NavBar />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
