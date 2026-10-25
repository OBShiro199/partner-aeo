"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartBar, ChatsCircle, Lightning, Strategy, TreeStructure } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { isDemo } from "@/lib/repo";
import { ago, normaliseDomain } from "@/lib/format";
import { Toolbar } from "@/components/shell/Toolbar";
import { RegionSelect } from "@/components/pickers";
import { isStuck, RiskTag } from "@/components/growth/AuditView";
import { Button, cx, Empty, Favicon, Field, LiveStatus, Meter } from "@/components/ui";

const WHAT = [
  { Icon: TreeStructure, title: "25 prompt variations", body: "The questions buyers ask AI, with monthly AI search volume from DataForSEO." },
  { Icon: ChartBar, title: "Citation map", body: "Answers from ChatGPT, Perplexity, Gemini and Claude, and every page they cite." },
  { Icon: ChatsCircle, title: "Sentiment", body: "How the engines describe the prospect and the competitor, in their own words." },
  { Icon: Lightning, title: "Sales kit", body: "Cold email, 2-minute talk track, closing script and an editable deck." },
];

export default function StrategyPage() {
  const s = useApp();
  const g = useGrowth();
  const router = useRouter();
  const [f, setF] = useState({ domain: "", keyword: "", competitor: "", region: s.agency!.regions.find((r) => r !== "GLOBAL") ?? "GB" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = g.credits?.strategy_runs;
  const left = c ? c.allowance - c.used : null;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const domain = normaliseDomain(f.domain);
    const competitor = f.competitor.trim() ? normaliseDomain(f.competitor) : null;
    if (!domain) return setErr("Enter the prospect's website, like acme.com.");
    if (f.keyword.trim().length < 2) return setErr("Add a seed keyword, like \"ai receptionist\".");
    if (f.competitor.trim() && !competitor) return setErr("That competitor domain doesn't look right.");
    setBusy(true);
    try {
      const id = await g.runStrategy({ prospect_domain: domain, keyword: f.keyword.trim(), competitor_domain: competitor, region: f.region });
      router.push(`/strategy/${id}`);
    } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  }

  return (
    <>
      <Toolbar>
        <span className="text-ink font-medium">Strategy Engine</span>
        {c && <span className="tag tnum">{c.used}/{c.allowance} runs this month</span>}
      </Toolbar>

      <section className="relative hair-b overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000 40%, transparent)" }} aria-hidden />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 p-4 md:p-6">
          <form onSubmit={run} className="card p-5 md:p-6" noValidate>
            <p className="text-blue-ink font-medium flex items-center gap-2"><span className="live-dot" /> AI Prompt Intent Strategy Engine</p>
            <h1 className="h2 mt-2">Map a prospect&apos;s AI search market</h1>
            <p className="text-muted mt-1 mb-5">Run it before a sales call. Leads from your widget get one automatically.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Prospect website" htmlFor="s-d"><input id="s-d" className="input" placeholder="prospect.com" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></Field>
              <Field label="Seed keyword" htmlFor="s-k"><input id="s-k" className="input" placeholder="e.g. ai receptionist" maxLength={80} value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} /></Field>
              <Field label="Main competitor" htmlFor="s-c" hint="Optional, but needed for share of voice."><input id="s-c" className="input" placeholder="competitor.com" value={f.competitor} onChange={(e) => setF({ ...f, competitor: e.target.value })} /></Field>
              <Field label="Market" htmlFor="s-r"><RegionSelect id="s-r" value={f.region} onChange={(v) => setF({ ...f, region: v })} /></Field>
            </div>
            <p role="alert" className="field-error mt-3">{err}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Button type="submit" variant="primary" size="large" loading={busy} disabled={isDemo}><Strategy size={16} className="text-blue" /> Run analysis</Button>
              <span className="text-faint">{left == null ? "" : left > 0 ? `Uses 1 of ${left} runs left this month` : g.credits?.overage_enabled ? `Over your allowance: $${c!.overage_usd.toFixed(2)} per run` : "No runs left this month"}</span>
            </div>
          </form>
          <div className="flex flex-col gap-3">
            {WHAT.map(({ Icon, title, body }) => (
              <div key={title} className="card p-4 flex gap-3 bg-surface/90">
                <span className="size-8 rounded-md border border-blue-edge bg-blue-soft grid place-items-center flex-none"><Icon size={16} className="text-blue-ink" /></span>
                <span><span className="block text-ink font-medium">{title}</span><span className="block text-muted">{body}</span></span>
              </div>
            ))}
            {c && (
              <div className="card p-4">
                <div className="flex justify-between mb-2"><span className="text-faint">Runs this month</span><span className="text-ink tnum">{c.used} of {c.allowance}</span></div>
                <Meter value={c.used} max={c.allowance} label="Strategy runs used" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="h-[44px] hair-b flex items-center px-4 md:px-6"><p className="text-ink font-medium">All analyses</p><span className="text-faint ml-2">Manual runs and widget scans</span></div>
        {!g.loaded ? <div className="p-6"><div className="skeleton h-5 w-1/3" /></div> : !g.audits.length ? (
          <Empty icon={<Strategy size={18} />} title="No analyses yet" body="Run one above, or install the widget to collect them from your website." action={<Link href="/widget" className="btn">Set up the widget</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead><tr><th style={{ width: 250 }}>Prospect</th><th>Keyword</th><th style={{ width: 100 }}>Source</th><th style={{ width: 160 }}>Score</th><th style={{ width: 210 }}>Status</th><th style={{ width: 100 }}>When</th></tr></thead>
              <tbody>
                {g.audits.map((a) => {
                  const lead = g.leads.find((l) => l.audit_id === a.id);
                  return (
                    <tr key={a.id} className="cursor-pointer" onClick={() => router.push(`/strategy/${a.id}`)}>
                      <td><span className="flex items-center gap-2.5 min-w-0"><Favicon domain={a.prospect_domain} name={a.prospect_name ?? a.prospect_domain} size={20} /><Link href={`/strategy/${a.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-ink font-medium">{a.prospect_name ?? a.prospect_domain}</Link></span></td>
                      <td className="text-muted truncate">&ldquo;{a.keyword}&rdquo;{a.competitor_domain && <span className="text-faint"> vs {a.competitor_name ?? a.competitor_domain}</span>}</td>
                      <td><span className={cx("tag", a.source === "widget" ? "tag-teal" : "tag-blue")}>{a.source === "widget" ? (lead ? "Lead" : "Widget") : "Manual"}</span></td>
                      <td><span className="flex items-center gap-2"><span className="text-ink tnum font-medium">{a.score ?? "–"}</span><RiskTag risk={a.risk} /></span></td>
                      <td>{(a.status === "running" || a.status === "queued") && !isStuck(a) ? <LiveStatus label={a.stage ?? "Queued"} /> : a.status === "failed" || isStuck(a) ? <span className="tag tag-red">Failed</span> : <span className="text-muted">{a.depth === "full" ? "Strategy pack ready" : "Score only"}</span>}</td>
                      <td className="text-faint">{ago(a.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
