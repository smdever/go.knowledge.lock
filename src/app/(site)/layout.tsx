import type { Metadata } from "next";
import { SITE_URL } from "@/components/site/content";

/** knowledge-lock.com: the Knowledge Lock website and the demo. Share images and links resolve against its address. */
export const metadata: Metadata = { metadataBase: new URL(SITE_URL) };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
