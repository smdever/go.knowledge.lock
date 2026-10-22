import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";
import { getContext } from "@/lib/app/context";

export const metadata: Metadata = { title: "Knowledge Lock" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
