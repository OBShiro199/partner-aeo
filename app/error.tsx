"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react";

// Catches a crash in any page so one broken screen never blanks the whole app.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="relative min-h-[70dvh] grid place-items-center px-6 overflow-hidden">
      <div className="absolute inset-0 grid-bg grid-fade opacity-80" aria-hidden />
      <div className="relative max-w-[380px] text-center flex flex-col items-center gap-3">
        <span className="size-10 rounded-md border border-hairline bg-surface grid place-items-center text-[var(--danger-ink)]"><Warning size={18} /></span>
        <h1 className="t-16 font-medium text-ink">Something went wrong on this screen</h1>
        <p className="text-muted">Nothing was lost. Try again, and if it keeps happening, reload the page.</p>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary" onClick={() => retry()}>Try again</button>
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
