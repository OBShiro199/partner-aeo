"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";

// Footer links in optional emails land here. Unsubscribing takes a button press,
// because inbox link scanners open every link in an email.
export default function UnsubscribePage() {
  const [q, setQ] = useState<{ t: string; k: string } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    const s = new URLSearchParams(location.search);
    setQ({ t: s.get("t") ?? "", k: s.get("k") === "alerts" ? "alerts" : "weekly_digest" });
  }, []);
  const what = q?.k === "alerts" ? "visibility alerts" : "the weekly summary";

  async function go() {
    if (!q) return;
    setState("busy");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-unsubscribe?t=${encodeURIComponent(q.t)}&k=${q.k}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "That link didn't work.");
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col">
      <div className="absolute inset-0 grid-bg grid-fade" aria-hidden />
      <header className="relative h-14 flex items-center px-5"><Link href="/"><Wordmark /></Link></header>
      <main className="relative flex-1 grid place-items-center px-4 pb-16">
        <div className="w-full max-w-[420px] card p-6 sm:p-8 rise">
          <p className="text-faint mb-1.5">Email settings</p>
          {state === "done" ? (
            <>
              <h1 className="h2 mb-3">You&apos;re unsubscribed</h1>
              <p className="text-body">You won&apos;t get {what} any more. Turn it back on any time in <Link href="/settings#notifications" className="text-blue-ink">email settings</Link>.</p>
            </>
          ) : (
            <>
              <h1 className="h2 mb-3">Unsubscribe from {what}?</h1>
              <p className="text-body mb-6">You&apos;ll still get emails you need, like invites and account notices.</p>
              <Button variant="primary" size="large" className="w-full" loading={state === "busy"} onClick={go} disabled={!q?.t}>Unsubscribe</Button>
              <p role="alert" className="field-error mt-3">{state === "error" ? `${error} You can change email settings in the app instead.` : ""}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
