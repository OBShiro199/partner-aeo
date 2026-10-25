"use client";
// The public scanner, rendered inside an iframe on the agency's website (see public/widget.js).
// No sign-in. Everything visible is the agency's brand.
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Check, EnvelopeSimple, LockSimple, Warning } from "@phosphor-icons/react";
import { EngineLogo } from "@/lib/engines";
import { RISK_LABEL, type Risk } from "@/supabase/functions/_shared/audit.ts";
import { normaliseDomain } from "@/lib/format";
import { ScoreGauge } from "@/components/growth/ScoreGauge";
import { Button, Field } from "@/components/ui";

type Config = { key: string; enabled: boolean; headline: string; subhead: string; brand_color: string; logo_url: string | null; agency_name: string; agency_domain: string | null; contact_name: string | null; booking_url: string | null; default_region: string };
type Teaser = { score: number; risk: string; risk_label: string; deflection_rate: number | null; answers: number; prospect: { name: string; domain: string }; competitor: { name: string; domain: string } | null; invisible: number; asked: number; engines: string[] };
type Step = "form" | "scanning" | "result" | "sent";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ENGINES = ["chatgpt", "perplexity", "gemini", "claude"];
const TIPS = [
  "Asking ChatGPT, Perplexity, Gemini and Claude what your buyers ask",
  "Checking which brands each answer recommends",
  "Collecting the sources each engine cites",
  "Comparing you with your competitor",
];

async function fn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

export default function EmbedPage() {
  const { key } = useParams<{ key: string }>();
  const [cfg, setCfg] = useState<Config | null | "missing">(null);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ domain: "", keyword: "", competitor: "" });
  const [lead, setLead] = useState({ name: "", email: "", phone: "" });
  const [auditId, setAuditId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [tip, setTip] = useState(0);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    let h = q.get("host");
    if (!h && document.referrer) try { h = new URL(document.referrer).hostname; } catch { /* none */ }
    setHost(q.get("preview") ? location.hostname : h);
    fetch(`${URL_BASE}/rest/v1/rpc/widget_public`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_key: key }) })
      .then((r) => r.json()).then((d) => setCfg(d && d.key ? d : "missing")).catch(() => setCfg("missing"));
  }, [key]);

  // Tell the host page how tall we are, so the iframe never scrolls.
  useEffect(() => {
    if (!root.current || window.parent === window) return;
    const ro = new ResizeObserver(() => window.parent.postMessage({ type: "partner-aeo:height", key, height: Math.ceil(root.current!.getBoundingClientRect().height) + 2 }, "*"));
    ro.observe(root.current);
    return () => ro.disconnect();
  }, [key, cfg]);

  // Poll the scan.
  useEffect(() => {
    if (step !== "scanning" || !auditId) return;
    let stop = false;
    const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 3200);
    const poll = async () => {
      if (stop) return;
      try {
        const r = await fn<{ status: string; stage?: string; error?: string } & Partial<Teaser>>("widget", { key, action: "status", audit_id: auditId });
        if (r.status === "complete") { setTeaser(r as Teaser); setStep("result"); return; }
        if (r.status === "failed") { setError(r.error ?? "The scan didn't finish. Try again."); setStep("form"); return; }
        setStage(r.stage ?? null);
      } catch (e) { setError((e as Error).message); setStep("form"); return; }
      setTimeout(poll, 2500);
    };
    setTimeout(poll, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [step, auditId, key]);

  if (cfg === null) return <div className="min-h-[420px]" />;
  if (cfg === "missing" || !cfg.enabled) {
    return <div ref={root} className="p-8 text-center text-muted">{cfg === "missing" ? "This scanner isn't set up correctly." : "This scanner is switched off right now."}</div>;
  }
  const color = cfg.brand_color;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const domain = normaliseDomain(form.domain);
    const competitor = normaliseDomain(form.competitor);
    if (!domain) return setError("Enter your website, like acme.com.");
    if (form.keyword.trim().length < 2) return setError("Tell us what you sell, like \"accountants in Leeds\".");
    if (!competitor) return setError("Enter a competitor's website.");
    if (competitor === domain) return setError("Pick a competitor that isn't your own site.");
    setBusy(true);
    try {
      const r = await fn<{ audit_id: string }>("widget", { key, action: "start", domain, keyword: form.keyword.trim(), competitor, host });
      setAuditId(r.audit_id);
      setStage(null);
      setStep("scanning");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S{2,}$/.test(lead.email)) return setError("Enter a valid email address.");
    if (lead.phone.replace(/\D/g, "").length < 6) return setError("Enter a phone number.");
    setBusy(true);
    try { await fn("widget", { key, action: "lead", audit_id: auditId, ...lead }); setStep("sent"); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div ref={root} className="bg-surface text-body max-w-[640px] mx-auto" style={{ ["--wb" as string]: color }}>
      <div className="relative overflow-hidden border border-hairline rounded-[8px] m-px" style={{ borderTop: `3px solid ${color}` }}>
        <div className="absolute inset-0 grid-bg grid-fade opacity-60 pointer-events-none" aria-hidden />
        <div className="relative p-5 sm:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            {cfg.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cfg.logo_url} alt="" width={22} height={22} className="rounded-[4px]" />
              : <span className="size-[22px] rounded-full grid place-items-center text-[11px] font-medium" style={{ background: `${color}22`, color }}>{cfg.agency_name.charAt(0)}</span>}
            <span className="text-ink font-medium">{cfg.agency_name}</span>
            <span className="ml-auto flex items-center gap-1.5">{ENGINES.map((e) => <EngineLogo key={e} id={e} size={15} />)}</span>
          </div>

          {step === "form" && (
            <form onSubmit={start} className="step-in" noValidate>
              <h1 className="text-ink font-medium text-[22px] sm:text-[26px] leading-tight tracking-[-0.03em]">{cfg.headline}</h1>
              <p className="text-muted mt-2 mb-6">{cfg.subhead}</p>
              <div className="grid gap-4">
                <Field label="Your website" htmlFor="e-domain"><input id="e-domain" className="input" placeholder="yourbusiness.com" autoComplete="url" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></Field>
                <Field label="What you sell" htmlFor="e-kw" hint="The words a buyer would use."><input id="e-kw" className="input" placeholder="e.g. family solicitors in Leeds" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} maxLength={80} /></Field>
                <Field label="Your main competitor" htmlFor="e-comp"><input id="e-comp" className="input" placeholder="competitor.com" value={form.competitor} onChange={(e) => setForm({ ...form, competitor: e.target.value })} /></Field>
              </div>
              {error && <p role="alert" className="field-error mt-3 flex items-center gap-1.5"><Warning size={13} /> {error}</p>}
              <button type="submit" disabled={busy} className="btn btn-large w-full mt-5 font-medium" style={{ borderColor: color, color: "var(--ink)" }} data-loading={busy}>
                <span className="btn-label inline-flex items-center gap-2">Check my AI visibility <ArrowRight size={15} style={{ color }} /></span>
                <span className="btn-spinner" aria-hidden><span className="spinner" /></span>
              </button>
              <p className="text-faint t-12 mt-3 text-center">Free. Takes about a minute.</p>
            </form>
          )}

          {step === "scanning" && (
            <div className="step-in py-6 flex flex-col items-center text-center" aria-live="polite">
              <div className="relative size-[132px] grid place-items-center">
                <span className="absolute inset-0 rounded-full border border-hairline" />
                <span className="absolute inset-3 rounded-full border border-dashed border-hairline" style={{ animation: "orbit 14s linear infinite" }} />
                <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent 0 300deg, ${color}55 360deg)`, animation: "sweep 2.4s linear infinite", maskImage: "radial-gradient(circle, transparent 54%, #000 55%)" }} />
                <div className="grid grid-cols-2 gap-2.5">
                  {ENGINES.map((e, i) => <span key={e} className="size-8 rounded-md border border-hairline bg-surface grid place-items-center" style={{ animation: `pulse 1.6s ${i * 0.2}s ease-in-out infinite` }}><EngineLogo id={e} size={16} /></span>)}
                </div>
              </div>
              <p className="text-ink font-medium mt-6">Scanning {normaliseDomain(form.domain)}</p>
              <p key={tip} className="text-muted mt-1 step-in min-h-[20px]">{stage && !stage.startsWith("Asking") ? stage : TIPS[tip]}</p>
              <div className="w-full max-w-[280px] h-1 rounded-full bg-hover overflow-hidden mt-5">
                <div className="h-full w-1/3 rounded-full" style={{ background: color, animation: "shimmer-bar 1.8s ease-in-out infinite" }} />
              </div>
            </div>
          )}

          {step === "result" && teaser && (
            <div className="step-in">
              <div className="flex flex-col items-center text-center">
                <ScoreGauge value={teaser.score} color={color} size={220} />
                <span className={teaser.risk === "visible" ? "tag tag-green mt-3" : teaser.risk === "at_risk" ? "tag tag-amber mt-3" : "tag tag-red mt-3"}>{RISK_LABEL[teaser.risk as Risk] ?? teaser.risk_label}</span>
                {teaser.deflection_rate != null && teaser.competitor && (
                  <p className="text-ink mt-4 max-w-[400px]">
                    <span className="font-medium tnum" style={{ color: teaser.deflection_rate > 0.3 ? "var(--danger-ink)" : undefined }}>{Math.round(teaser.deflection_rate * 100)}%</span> of AI answers for your service steered buyers to <b className="font-medium">{teaser.competitor.name}</b> without mentioning you.
                  </p>
                )}
                <p className="text-faint mt-1">{teaser.answers} answers from {teaser.engines.length} AI engines · invisible in {teaser.invisible} of {teaser.asked} buyer questions</p>
              </div>

              <div className="mt-6 card p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3"><LockSimple size={15} style={{ color }} /><p className="text-ink font-medium">Your 3-page Executive Diagnostic Assessment is ready</p></div>
                <p className="text-muted mb-3">Enter your business email and phone number to unlock the full report and see your missing citation paths.</p>
                <ul className="grid gap-1.5 mb-4 text-muted">
                  <li className="flex gap-2"><Check size={14} className="mt-0.5 flex-none" style={{ color }} /> Share of voice vs {teaser.competitor?.name ?? "your competitor"} on each engine</li>
                  <li className="flex gap-2"><Check size={14} className="mt-0.5 flex-none" style={{ color }} /> The buyer questions where you&apos;re invisible</li>
                  <li className="flex gap-2"><Check size={14} className="mt-0.5 flex-none" style={{ color }} /> The sources AI trusts that don&apos;t mention you yet</li>
                </ul>
                <form onSubmit={unlock} className="grid gap-3" noValidate>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input className="input" placeholder="Name" autoComplete="name" aria-label="Name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                    <input className="input" placeholder="Phone" autoComplete="tel" type="tel" aria-label="Phone" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
                  </div>
                  <input className="input" placeholder="Work email" autoComplete="email" type="email" aria-label="Email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                  {error && <p role="alert" className="field-error flex items-center gap-1.5"><Warning size={13} /> {error}</p>}
                  <Button type="submit" size="large" loading={busy} className="w-full" style={{ borderColor: color }}>
                    <EnvelopeSimple size={15} style={{ color }} /> Unlock the full report
                  </Button>
                  <p className="text-faint t-12">{cfg.agency_name} will email the report and may contact you about it.</p>
                </form>
              </div>
            </div>
          )}

          {step === "sent" && (
            <div className="step-in py-8 flex flex-col items-center text-center">
              <span className="size-12 rounded-full grid place-items-center" style={{ background: `${color}1a`, border: `1px solid ${color}55` }}><Check size={20} weight="bold" style={{ color }} /></span>
              <p className="text-ink font-medium t-16 mt-4">Your report is on its way</p>
              <p className="text-muted mt-1 max-w-[360px]">Check {lead.email} in the next few minutes. It comes from {cfg.agency_name}.</p>
              {cfg.booking_url && (
                <a href={cfg.booking_url} target="_blank" rel="noreferrer" className="btn btn-large mt-6" style={{ borderColor: color }}>
                  Book a free walkthrough{cfg.contact_name ? ` with ${cfg.contact_name}` : ""} <ArrowRight size={15} style={{ color }} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
