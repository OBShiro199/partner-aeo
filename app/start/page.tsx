"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FilePdf, MapPin, Robot } from "@phosphor-icons/react";
import { repo } from "@/lib/repo";
import { normaliseDomain } from "@/lib/format";
import { saveSprint } from "@/lib/sprint";
import { Wordmark } from "@/components/brand";
import { RegionSelect } from "@/components/pickers";
import { Button, Field } from "@/components/ui";

// The agency acquisition hook: one free client audit and five scored local leads for signing up.
export default function StartPage() {
  const router = useRouter();
  const [f, setF] = useState({ client_url: "", niche: "", location: "", region: "US" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const client = normaliseDomain(f.client_url);
    if (!client) return setErr("Enter your client's website, like clientdomain.com.");
    if (f.niche.trim().length < 3) return setErr("Add a niche, like \"roofing contractors\".");
    if (f.location.trim().length < 2) return setErr("Add a town or city, like \"Denver, CO\".");
    setBusy(true);
    saveSprint({ client_url: client, niche: f.niche.trim(), location: f.location.trim(), region: f.region });
    const user = await repo.currentUser().catch(() => null);
    router.push(user ? "/sprint" : "/signup?from=start");
  }

  return (
    <div className="min-h-dvh bg-surface text-body">
      <header className="h-14 hair-b flex items-center px-4 sm:px-6">
        <Link href="/"><Wordmark /></Link>
        <Link href="/login" className="ml-auto text-muted hover:text-ink">Log in</Link>
      </header>
      <main className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000 50%, transparent)" }} aria-hidden />
        <div className="relative mx-auto max-w-[1080px] px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-[1fr_440px] gap-10 items-start">
          <div>
            <p className="text-blue-ink font-medium inline-flex items-center gap-2"><span className="live-dot" /> For agencies</p>
            <h1 className="text-ink text-[36px] sm:text-[48px] leading-[1.05] font-medium tracking-[-0.04em] mt-3 max-w-[560px]">Get 1 client audit and 5 new leads, free</h1>
            <p className="text-muted t-16 mt-4 max-w-[520px]">We audit one of your clients for AI search, then find five local businesses in your niche that ChatGPT, Perplexity, Gemini and Claude can&apos;t see. Each comes with a report in your branding, ready to send.</p>
            <ul className="mt-8 flex flex-col gap-4 max-w-[520px]">
              {[
                { Icon: Robot, t: "AI search audit of your client", b: "Their score, the questions they're invisible on, and whether AI crawlers can even read their site." },
                { Icon: MapPin, t: "5 local prospects with visibility gaps", b: "Real businesses from Google Maps, with phone numbers, each audited the same way." },
                { Icon: FilePdf, t: "White-label PDFs", b: "Your logo, colours and booking link. Our name never appears." },
              ].map(({ Icon, t, b }) => (
                <li key={t} className="flex gap-3">
                  <span className="size-9 rounded-md border border-blue-edge bg-blue-soft grid place-items-center flex-none"><Icon size={17} className="text-blue-ink" /></span>
                  <span><span className="block text-ink font-medium">{t}</span><span className="block text-muted">{b}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <form onSubmit={go} className="card p-5 sm:p-6 shadow-[0_12px_40px_rgba(8,9,10,0.06)]" noValidate>
            <div className="grid gap-4">
              <Field label="Your client's website" htmlFor="st-c"><input id="st-c" className="input" placeholder="clientdomain.com" autoFocus value={f.client_url} onChange={(e) => setF({ ...f, client_url: e.target.value })} /></Field>
              <Field label="Niche for new leads" htmlFor="st-n"><input id="st-n" className="input" placeholder="e.g. roofing contractors" maxLength={60} value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} /></Field>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Town or city" htmlFor="st-l"><input id="st-l" className="input" placeholder="e.g. Denver, CO" maxLength={60} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
                <RegionSelect id="st-r" value={f.region} onChange={(v) => setF({ ...f, region: v })} />
              </div>
            </div>
            <p role="alert" className="field-error mt-3">{err}</p>
            <Button type="submit" variant="primary" size="large" loading={busy} className="w-full mt-1">Generate 1 client audit + 5 leads free <ArrowRight size={15} className="text-blue" /></Button>
            <ul className="mt-4 flex flex-col gap-1.5 text-faint t-12">
              {["Free 14-day trial, no card needed", "Ready in a few minutes", "Cancel any time"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={12} className="text-blue" />{t}</li>)}
            </ul>
          </form>
        </div>
      </main>
    </div>
  );
}
