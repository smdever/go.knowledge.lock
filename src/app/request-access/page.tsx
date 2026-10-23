import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/app/AppShell";
import { RequestAccessForm } from "@/components/app/forms";
import { requestAccessAction } from "@/app/app/actions";
import { getUser } from "@/lib/app/auth";

export const metadata: Metadata = { title: "Request access | Knowledge Lock" };

export default async function RequestAccessPage() {
  if (await getUser()) redirect("/app");
  return (
    <PublicShell>
      <RequestAccessForm action={requestAccessAction} />
    </PublicShell>
  );
}
