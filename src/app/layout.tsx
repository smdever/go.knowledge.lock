import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { isAppMode } from "@/lib/mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Lock demo | Guided Orchestration",
  description:
    "See stakeholders and multiple AI models agree on requirements, lock them, and keep teams and agents building from the same signed-off source.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Cookie-free page counts on knowledge-lock.com (the website and demo) only, never in the product. */}
        {isAppMode() ? null : <Analytics />}
      </body>
    </html>
  );
}
