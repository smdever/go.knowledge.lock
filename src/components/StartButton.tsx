"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useKL } from "./KLContext";

export default function StartButton({ parentLockId, label = "Start the demo" }: { parentLockId?: string; label?: string }) {
  const router = useRouter();
  const { api, recordPath } = useKL();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const view = await api.createRecord(parentLockId);
      router.push(recordPath(view.record.id));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-[0_4px_18px_rgba(238,108,77,0.35)] transition hover:bg-accent-hover disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        <span>{label}</span>
        {!busy ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
      {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
    </div>
  );
}
