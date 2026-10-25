"use client";
import { useState } from "react";
import { ArrowClockwise, Check, Copy, FilePdf, PresentationChart, Sparkle, Warning } from "@phosphor-icons/react";
import { ENGINE_LABEL, RISK_LABEL, type ProspectReport } from "@/supabase/functions/_shared/audit.ts";
import { brandVariants } from "@/supabase/functions/_shared/analyse";
import { EngineLogo } from "@/lib/engines";
import { FlagIcon } from "@/lib/regions";
import { INTENT_LABEL, INTENT_TAG, num, usd } from "@/lib/format";
import { downloadDeck, downloadReportPdf } from "@/lib/sales-files";
import type { Agency, Audit, Widget } from "@/lib/types";
import { AnswerText } from "@/components/AnswerText";
import { Button, cx, Favicon, LiveStatus, Sparkline } from "@/components/ui";
import { ScoreGauge } from "./ScoreGauge";

const TABS = ["Report", "Blueprint", "Sentiment", "Sales kit", "Answers"] as const;
type Tab = (typeof TABS)[number];

const LITE_STAGES = ["Reading", "Writing buyer prompts", "Asking ChatGPT, Perplexity, Gemini and Claude"];
const FULL_STAGES = [...LITE_STAGES, "Measuring AI search demand", "Reading how AI describes each brand", "Writing the sales kit"];

export const isStuck = (a: Audit) => (a.status === "running" || a.status === "queued") && Date.now() - new Date(a.created_at).getTime() > 6 * 60_000 && !a.finished_at;

export function RiskTag({ risk }: { risk: Audit["risk"] }) {
  if (!risk) return null;
  return <span className={cx("tag", risk === "high" ? "tag-red" : risk === "at_risk" ? "tag-amber" : "tag-green")}>{RISK_LABEL[risk]}</span>;
}

export function AuditView({ audit, agency, widget, onRetry }: { audit: Audit; agency: Agency; widget: Widget | null; onRetry: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("Report");
  const [busy, setBusy] = useState<string | null>(null);
  const r = audit.report as ProspectReport;
  const hasReport = !!r?.prospect;
  const running = (audit.status === "running" || audit.status === "queued") && !isStuck(audit);
  const brand = { agency, widget };

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  return (
    <>
      <section className="relative hair-b overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000, transparent)" }} aria-hidden />
        <div className="relative px-4 md:px-6 pt-7 pb-5 flex flex-wrap items-center gap-5">
          <Favicon domain={audit.prospect_domain} name={audit.prospect_name ?? audit.prospect_domain} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="h1 truncate">{audit.prospect_name ?? audit.prospect_domain}</h1>
              <RiskTag risk={audit.risk} />
            </div>
            <p className="text-muted mt-1 flex items-center gap-2 flex-wrap">
              {audit.prospect_domain} <span className="text-ghost">·</span> &ldquo;{audit.keyword}&rdquo;
              {audit.competitor_domain && <><span className="text-ghost">·</span> vs {audit.competitor_name ?? audit.competitor_domain}</>}
              <span className="text-ghost">·</span> <FlagIcon code={audit.region} size={14} /> {audit.region}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="compact" disabled={!hasReport} loading={busy === "pdf"} onClick={() => act("pdf", () => downloadReportPdf(audit, brand))}>
              <FilePdf size={14} /> Prospect PDF
            </Button>
            <Button size="compact" variant="blue" disabled={!hasReport} loading={busy === "deck"} onClick={() => act("deck", () => downloadDeck(audit, brand))}>
              <PresentationChart size={14} /> Closing deck (.pptx)
            </Button>
          </div>
        </div>
      </section>

      {running && <Progress audit={audit} />}
      {(audit.status === "failed" || isStuck(audit)) && (
        <div className="m-4 md:m-6 card p-4 flex items-center gap-3 border-[#f5c4c4]">
          <Warning size={18} className="text-[var(--danger-ink)] flex-none" />
          <p className="flex-1 text-body">{audit.error ?? "This analysis stopped before it finished."}</p>
          <Button size="compact" loading={busy === "retry"} onClick={() => act("retry", onRetry)}><ArrowClockwise size={14} /> Try again</Button>
        </div>
      )}

      {hasReport && (
        <>
          <div className="h-[44px] hair-b flex items-center gap-1 px-4 md:px-6 overflow-x-auto no-scrollbar" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cx("h-[44px] px-2.5 -mb-px border-b-2 transition-colors whitespace-nowrap", tab === t ? "border-blue text-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
                {t}
              </button>
            ))}
            <span className="ml-auto text-faint whitespace-nowrap pl-4 tnum">{audit.cached_from ? "Reused a scan from this week" : `API cost ${usd(Number(audit.cost_usd), 3)}`}</span>
          </div>
          <div key={tab} className="rise">
            {tab === "Report" && <ReportTab audit={audit} r={r} color={widget?.brand_color} />}
            {tab === "Blueprint" && (audit.depth === "full" ? <BlueprintTab audit={audit} /> : <Upgrade audit={audit} running={running} busy={busy === "retry"} onRun={() => act("retry", onRetry)} what="the 25-prompt blueprint" />)}
            {tab === "Sentiment" && (audit.hub.sentiment ? <SentimentTab audit={audit} /> : <Upgrade audit={audit} running={running} busy={busy === "retry"} onRun={() => act("retry", onRetry)} what="the sentiment read" />)}
            {tab === "Sales kit" && (audit.assets.cold_email ? <KitTab audit={audit} /> : <Upgrade audit={audit} running={running} busy={busy === "retry"} onRun={() => act("retry", onRetry)} what="the sales kit" />)}
            {tab === "Answers" && <AnswersTab audit={audit} />}
          </div>
        </>
      )}
    </>
  );
}

function Progress({ audit }: { audit: Audit }) {
  const stages = audit.depth === "full" ? FULL_STAGES : LITE_STAGES;
  const cur = audit.stage ? stages.findIndex((s) => audit.stage!.startsWith(s)) : -1;
  return (
    <div className="m-4 md:m-6 card p-5 relative overflow-hidden">
      <div className="absolute inset-0 dots-bg opacity-60" aria-hidden />
      <div className="relative">
        <LiveStatus label={audit.stage ?? "Queued"} />
        <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stages.map((s, i) => (
            <li key={s} className={cx("flex items-center gap-2 t-12", i < cur ? "text-muted" : i === cur ? "text-ink font-medium" : "text-ghost")}>
              <span className={cx("size-4 rounded-full grid place-items-center border flex-none", i < cur ? "bg-blue border-blue" : i === cur ? "border-blue" : "border-hairline")}>
                {i < cur && <Check size={9} weight="bold" color="#fff" />}
              </span>
              {s === "Reading" ? "Reading the site" : s.replace("ChatGPT, Perplexity, Gemini and Claude", "4 engines")}
            </li>
          ))}
        </ol>
        <p className="text-faint mt-4">Takes one to three minutes. You can leave this page; it keeps running.</p>
      </div>
    </div>
  );
}

function Upgrade({ audit, running, busy, onRun, what }: { audit: Audit; running: boolean; busy: boolean; onRun: () => void; what: string }) {
  return (
    <div className="relative overflow-hidden grid place-items-center text-center px-6 py-16">
      <div className="absolute inset-0 grid-bg grid-fade opacity-80" aria-hidden />
      <div className="relative max-w-[380px] flex flex-col items-center gap-3">
        <div className="size-10 rounded-md border border-hairline bg-surface grid place-items-center text-blue"><Sparkle size={18} /></div>
        <h3 className="t-14 font-medium text-ink">{running ? `Writing ${what}` : `${what.charAt(0).toUpperCase()}${what.slice(1)} isn't built yet`}</h3>
        <p className="text-muted">{running ? "It appears here as soon as it's ready." : audit.source === "widget" ? "Build the full strategy pack for this lead. It doesn't use a strategy run." : "Run the full analysis to build it."}</p>
        {!running && <Button variant="blue" loading={busy} onClick={onRun}><Sparkle size={14} /> Build strategy pack</Button>}
      </div>
    </div>
  );
}

function Section({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("p-4 md:p-6 hair-b", className)}>
      <h2 className="t-14 font-medium text-ink">{title}</h2>
      {sub && <p className="text-faint mt-0.5">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReportTab({ audit, r, color }: { audit: Audit; r: ProspectReport; color?: string }) {
  const comp = r.competitor?.name ?? "Competitor";
  const notes = audit.hub.notes ?? [];
  return (
    <>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] hair-b">
        <div className="p-6 flex flex-col items-center justify-center gap-4 lg:hair-r max-lg:hair-b">
          <ScoreGauge value={r.score} color={color} />
          <div className="grid grid-cols-2 w-full max-w-[340px] card divide-x divide-divider">
            <div className="p-3">
              <p className="text-faint t-12">Deflection rate</p>
              <p className={cx("t-16 font-medium tnum mt-0.5", (r.deflection_rate ?? 0) > 0.3 ? "text-[var(--danger-ink)]" : "text-ink")}>{r.deflection_rate == null ? "–" : `${Math.round(r.deflection_rate * 100)}%`}</p>
            </div>
            <div className="p-3">
              <p className="text-faint t-12">Answers analysed</p>
              <p className="t-16 font-medium tnum mt-0.5 text-ink">{r.answers}</p>
            </div>
          </div>
          {r.competitor && r.deflection_rate != null && <p className="text-muted text-center max-w-[340px]">{Math.round(r.deflection_rate * 100)}% of answers recommended {comp} and didn&apos;t mention {r.prospect.name}.</p>}
        </div>
        <div className="p-4 md:p-6">
          <h2 className="t-14 font-medium text-ink">Share of voice</h2>
          <p className="text-faint mt-0.5">Answers that named each brand, per engine.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="table min-w-[460px]">
              <thead><tr><th style={{ width: 150 }}>Engine</th><th>{r.prospect.name}</th>{r.competitor && <th>{comp}</th>}</tr></thead>
              <tbody>
                {r.engines.map((e) => (
                  <tr key={e.engine}>
                    <td><span className="inline-flex items-center gap-2 text-ink"><EngineLogo id={e.engine} /> {ENGINE_LABEL[e.engine]}</span></td>
                    <td><ShareBar n={e.prospect} of={e.answers} color={color ?? "var(--blue)"} /></td>
                    {r.competitor && <td><ShareBar n={e.competitor} of={e.answers} color="var(--faint)" /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {notes.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1">
              {notes.map((n) => <li key={n} className="text-faint t-12 flex gap-1.5"><Warning size={12} className="mt-0.5 flex-none" /> {n}</li>)}
            </ul>
          )}
        </div>
      </div>
      <Section title="Questions buyers ask" sub="Each was asked live. These go on page 2 of the prospect PDF.">
        <ul className="card divide-y divide-divider">
          {r.prompts.map((p) => (
            <li key={p.text} className="p-3 px-4 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-[240px] text-ink">&ldquo;{p.text}&rdquo;</span>
              <span className="flex items-center gap-1">{p.engines.map((e) => <EngineLogo key={e} id={e} size={14} />)}</span>
              <span className={cx("tag", p.prospect_seen ? "tag-green" : "tag-red")}>{p.prospect_seen ? "Mentioned" : "Invisible"}</span>
              {r.competitor && <span className={cx("tag", p.competitor_seen && "tag-amber")}>{p.competitor_seen ? `${comp} named` : `${comp} not named`}</span>}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Citation gaps" sub="Third-party pages the engines cited where the prospect wasn't named. Page 3 of the PDF.">
        {r.gaps.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead><tr><th>Source</th><th style={{ width: 120 }}>{comp}</th><th style={{ width: 120 }}>{r.prospect.name}</th><th style={{ width: 80 }}>Cited</th></tr></thead>
              <tbody>
                {r.gaps.map((g) => (
                  <tr key={g.url}>
                    <td className="min-w-0"><a href={g.url} target="_blank" rel="noreferrer" className="text-ink hover:underline">{g.domain}</a>{g.title && <span className="block text-faint t-12 truncate max-w-[420px]">{g.title}</span>}</td>
                    <td>{r.competitor ? <Mark ok={g.with_competitor} /> : "–"}</td>
                    <td><Mark ok={g.with_prospect} /></td>
                    <td className="tnum text-muted">{g.count}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted">The engines didn&apos;t cite third-party pages for these questions.</p>}
      </Section>
    </>
  );
}

function ShareBar({ n, of, color }: { n: number; of: number; color: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="h-2 w-full max-w-[160px] rounded-full bg-hover overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${of ? (n / of) * 100 : 0}%`, background: color, transition: "width 600ms var(--ease-morph)" }} />
      </span>
      <span className={cx("tnum whitespace-nowrap", n ? "text-ink" : "text-faint")}>{n} of {of}</span>
    </span>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok
    ? <span className="tag tag-green" aria-label="Yes"><Check size={11} weight="bold" /> Yes</span>
    : <span className="tag tag-red" aria-label="No">No</span>;
}

function BlueprintTab({ audit }: { audit: Audit }) {
  const vars = audit.hub.variations ?? [];
  const map = audit.hub.citation_map ?? [];
  const tested = new Set((audit.hub.cells ?? []).filter((c) => c.ok).map((c) => c.prompt));
  return (
    <>
      <Section title={`${vars.length} prompt variations`} sub={`Ordered by buying intent. AI search volume is monthly, from DataForSEO AI Keyword Data${audit.hub.category ? `. Category: ${audit.hub.category}` : ""}.`}>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead><tr><th style={{ width: 36 }}>#</th><th>Prompt</th><th style={{ width: 200 }}>Keyword</th><th style={{ width: 110 }}>Intent</th><th style={{ width: 100 }} className="text-right">AI volume</th><th style={{ width: 100 }}>12 months</th></tr></thead>
            <tbody>
              {vars.map((v, i) => (
                <tr key={v.prompt}>
                  <td className="text-faint tnum">{i + 1}</td>
                  <td className="text-ink">{v.prompt}{tested.has(v.prompt) && <span className="tag ml-2">Tested</span>}</td>
                  <td className="text-muted">{v.keyword}</td>
                  <td><span className={cx("tag", INTENT_TAG[v.intent])}>{INTENT_LABEL[v.intent] ?? v.intent}</span></td>
                  <td className="text-right tnum">{v.volume == null ? <span className="text-ghost">–</span> : num(v.volume)}</td>
                  <td>{v.trend?.length ? <Sparkline values={v.trend} width={84} height={20} /> : <span className="text-ghost">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Target citation URLs" sub="Pages the engines cite for this category, sorted by where the competitor appears and the prospect doesn't.">
        {map.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead><tr><th>Page</th><th style={{ width: 130 }}>Engines</th><th style={{ width: 110 }}>Competitor</th><th style={{ width: 110 }}>Prospect</th><th style={{ width: 70 }}>Cited</th></tr></thead>
              <tbody>
                {map.map((c) => (
                  <tr key={c.url}>
                    <td className="min-w-0"><a href={c.url} target="_blank" rel="noreferrer" className="text-ink hover:underline">{c.domain}</a><span className="block text-faint t-12 truncate max-w-[420px]">{c.title ?? c.url}</span></td>
                    <td><span className="flex items-center gap-1">{c.engines.map((e) => <EngineLogo key={e} id={e} size={14} />)}</span></td>
                    <td><Mark ok={c.with_competitor} /></td>
                    <td><Mark ok={c.with_prospect} /></td>
                    <td className="tnum text-muted">{c.count}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted">No third-party pages were cited.</p>}
      </Section>
    </>
  );
}

function SentimentTab({ audit }: { audit: Audit }) {
  const s = audit.hub.sentiment!;
  const r = audit.report as ProspectReport;
  const m = audit.hub.mentions;
  const card = (name: string, v: typeof s.prospect | null, mention: NonNullable<typeof m>["prospect"] | undefined) => v && (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink font-medium t-14">{name}</p>
        <span className={cx("tag capitalize", v.sentiment === "positive" ? "tag-green" : v.sentiment === "negative" ? "tag-red" : v.sentiment === "absent" ? "" : "tag-blue")}>{v.sentiment}</span>
      </div>
      <p className="text-body mt-3">{v.summary}</p>
      {v.adjectives.length > 0 && <div className="flex flex-wrap gap-1.5 mt-4">{v.adjectives.map((a) => <span key={a} className="chip h-7">{a}</span>)}</div>}
      {mention && (
        <div className="mt-5 pt-4 hair-t">
          <p className="text-faint t-12">LLM Mentions: {mention.total ?? mention.questions.length} questions where ChatGPT mentions this domain</p>
          <ul className="mt-2 flex flex-col gap-1">{mention.questions.slice(0, 5).map((q) => <li key={q.question} className="text-muted">&ldquo;{q.question}&rdquo;{q.volume ? <span className="text-faint tnum"> · {num(q.volume)}/mo</span> : null}</li>)}</ul>
        </div>
      )}
    </div>
  );
  return (
    <Section title="How AI describes each brand" sub={s.source === "llm_mentions" ? "From DataForSEO LLM Mentions and the answers we collected." : "From the answers we collected. LLM Mentions is off on this platform; turn on platform_limits.mentions_enabled to add it."}>
      <div className="grid md:grid-cols-2 gap-3">
        {card(r.prospect.name, s.prospect, m?.prospect ?? undefined)}
        {r.competitor && card(r.competitor.name, s.competitor, m?.competitor ?? undefined)}
      </div>
    </Section>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="h-11 px-4 hair-b flex items-center justify-between">
        <p className="text-ink font-medium">{title}</p>
        <button className="btn btn-ghost btn-compact" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 whitespace-pre-wrap font-sans text-body leading-6">{text}</pre>
    </div>
  );
}

function KitTab({ audit }: { audit: Audit }) {
  const k = audit.assets;
  return (
    <>
      <Section title="Outreach" sub={k.source === "haiku" ? "Written by Claude from this analysis. Edit before sending." : "Written from a template (Claude wasn't available). Edit before sending."}>
        <div className="grid xl:grid-cols-2 gap-3">
          {k.cold_email && <CopyBlock title="Cold email" text={`Subject: ${k.cold_email.subject}\n\n${k.cold_email.body}`} />}
          {k.talk_track && <CopyBlock title="2-minute phone talk track" text={k.talk_track} />}
        </div>
      </Section>
      <Section title="Closing script" sub="What to say on each slide of the deck. It's also in the .pptx speaker notes.">
        <ol className="card divide-y divide-divider">
          {(k.closing_script ?? []).map((s, i) => (
            <li key={s.slide} className="p-4 grid sm:grid-cols-[200px_1fr] gap-2">
              <span className="text-ink font-medium"><span className="text-faint tnum mr-2">{i + 1}</span>{s.slide}</span>
              <span className="text-body">{s.say || <span className="text-ghost">No notes</span>}</span>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function AnswersTab({ audit }: { audit: Audit }) {
  const cells = (audit.hub.cells ?? []).filter((c) => c.ok);
  const r = audit.report as ProspectReport;
  const [open, setOpen] = useState<number | null>(0);
  const brand = brandVariants(r.prospect.name, r.prospect.domain);
  const comps = r.competitor ? brandVariants(r.competitor.name, r.competitor.domain) : [];
  return (
    <Section title={`${cells.length} answers`} sub="The raw answers behind the report. Prospect highlighted, competitor underlined.">
      <ul className="card divide-y divide-divider">
        {cells.map((c, i) => (
          <li key={`${c.prompt}|${c.engine}`}>
            <button className="w-full p-3 px-4 flex items-center gap-3 text-left hover:bg-row-hover" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <EngineLogo id={c.engine} />
              <span className="flex-1 min-w-0 truncate text-ink">{c.prompt}</span>
              <span className={cx("tag", c.prospect ? "tag-green" : "tag-red")}>{c.prospect ? "Mentioned" : "Invisible"}</span>
              {r.competitor && c.competitor && <span className="tag tag-amber max-sm:hidden">{r.competitor.name}</span>}
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-body leading-6">
                <AnswerText text={c.text} brand={brand} competitors={comps} />
                {c.citations.length > 0 && <p className="text-faint t-12 mt-3">Sources: {c.citations.slice(0, 8).map((x) => x.domain).join(", ")}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
