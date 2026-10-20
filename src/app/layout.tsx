import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Lock — Enterprise Multi-AI Governance & Cryptographic Seals",
  description:
    "Cross-audit high-stakes business decisions with Google Gemini, Anthropic Claude, and OpenAI GPT before executive sign-off and tamper-proof cryptographic sealing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
