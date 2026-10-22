"use client";
import { useEffect, useState } from "react";
import { CaretDown, Check, Flask, Lightning } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { isDemo } from "@/lib/repo";
import { EngineLogo, engineById, liveEngineIds } from "@/lib/engines";
import { brandVariants } from "@/supabase/functions/_shared/analyse";
import { plural, usd } from "@/lib/format";
import type { Result } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { AnswerText } from "@/components/AnswerText";
import { Button, cx, Empty, Favicon, Field, LiveStatus, Menu, Meter } from "@/components/ui";

// Per-check cost measured on live checks (22 Oct 2026); Claude not measured yet.
const ESTIMATE: Record<string, string> = { chatgpt: "≈ $0.030", claude: "≈ $0.02–0.04", gemini: "≈ $0.037", perplexity: "≈ $0.006" };

export default function LabPage() {
  const s = useApp();
  const engines = liveEngineIds(s.agency!.engines);
  const [clientId, setClientId] = useState(s.filterClient ?? s.clients[0]?.id ?? "");
  const [engine, setEngine] = useState(engines[0] ?? "chatgpt");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const client = s.clients.find((c) => c.id === clientId);
  const running = Object.keys(s.checking).length > 0;
  const dfs = s.dfs;
  const left = dfs ? Math.max(0, dfs.calls_max - dfs.calls_used) : null;

  useEffect(() => { s.loadDfs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = s.prompts.find((x) => x.client_id === clientId && x.active);
    if (p && !prompt) setPrompt(p.text);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    if (!client || prompt.trim().length < 3) return;
    const match = s.prompts.find((p) => p.client_id === clientId && p.text === prompt.trim());
    const r = await s.runCheck({ clientId, engine, ...(match ? { promptId: match.id } : { promptText: prompt.trim() }) });
    if (r) setResult(r);
  }

  if (!s.clients.length) return (
    <>
      <Toolbar><span className="text-ink font-medium">API lab</span></Toolbar>
      <Empty icon={<Flask size={18} />} title="Add a client first" body="The lab runs one prompt for one client on one engine, so you can see exactly what comes back." action={<Button variant="primary" onClick={() => s.setAddClientOpen(true)}>Add client</Button>} />
    </>
  );

  return (
    <>
      <Toolbar>
        <span className="text-ink font-medium">API lab</span>
        <span className="text-faint hidden sm:inline">One prompt, one engine, one check at a time</span>
      </Toolbar>
      <div className="grid lg:grid-cols-[1fr_340px] flex-1">
        <div className="min-w-0 lg:hair-r">
          <section className="p-4 md:p-6 hair-b flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Client">
                <Menu width={300} trigger={(p) => (
                  <button {...p} className="input flex items-center gap-2 text-left">
                    {client && <Favicon src={client.favicon_url} domain={client.domain} name={client.name} size={18} />}
                    <span className="flex-1 truncate text-ink">{client?.name ?? "Pick a client"}</span>
                    <CaretDown size={14} className="text-faint" />
                  </button>
                )}>
                  {(close) => <div className="max-h-[280px] overflow-y-auto">{s.clients.map((c) => (
                    <button key={c.id} className="menu-item" data-active={c.id === clientId} onClick={() => { setClientId(c.id); setPrompt(""); close(); }}>
                      <Favicon src={c.favicon_url} domain={c.domain} name={c.name} size={16} /><span className="flex-1 truncate">{c.name}</span>{c.id === clientId && <Check size={14} className="text-blue" />}
                    </button>
                  ))}</div>}
                </Menu>
              </Field>
              <Field label="Engine">
                <div className="grid grid-cols-4 gap-1.5">
                  {engines.map((e) => (
                    <button key={e} type="button" aria-pressed={engine === e} onClick={() => setEngine(e)} title={engineById(e)?.name}
                      className={cx("h-9 rounded-md border grid place-items-center transition-colors", engine === e ? "border-blue-edge bg-blue-soft" : "border-hairline hover:bg-row-hover")}>
                      <EngineLogo id={e} size={16} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Prompt" hint={`Sent exactly as written, with no system prompt, to ${engineById(engine)?.name}. Est. ${ESTIMATE[engine] ?? "a few cents"} per check.`}>
              <textarea className="input" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Best CRM for plumbers in Leeds" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {s.prompts.filter((p) => p.client_id === clientId && p.active).slice(0, 6).map((p) => (
                <button key={p.id} className="chip h-7 max-w-[260px]" aria-pressed={prompt === p.text} onClick={() => setPrompt(p.text)}><span className="truncate">{p.text}</span></button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="large" loading={running} onClick={run} disabled={!client || prompt.trim().length < 3 || (!isDemo && left === 0)} minWidth={200}>
                <Lightning size={15} weight="fill" className="text-blue" /> Run 1 check
              </Button>
              {running && <LiveStatus label={`Asking ${engineById(engine)?.name}. Live checks take 10 to 60 seconds`} />}
            </div>
          </section>

          <section className="p-4 md:p-6">
            {result ? (
              <div className="fade-in">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="tag"><EngineLogo id={result.engine} size={12} /> {result.model}</span>
                  <span className={cx("tag", result.status === "failed" ? "tag-red" : result.mentioned ? "tag-green" : "tag-red")}>
                    {result.status === "failed" ? "Failed" : result.mentioned ? `${client?.name} mentioned${result.position ? ` · #${result.position}` : ""}` : `${client?.name} not mentioned`}
                  </span>
                  {result.own_domain_cited && <span className="tag tag-blue">Site cited</span>}
                  <span className="tag tnum">{usd(result.cost_usd, 4)}</span>
                  {result.latency_ms && <span className="tag tnum">{(result.latency_ms / 1000).toFixed(1)}s</span>}
                </div>
                {result.status === "failed" ? <p className="text-danger-ink">{result.error}</p> : (
                  <AnswerText text={result.response_text ?? ""} brand={client ? brandVariants(client.name, client.domain, client.aliases) : []} competitors={s.competitors.filter((c) => c.client_id === clientId).map((c) => c.name)} />
                )}
                {result.citations.length > 0 && (
                  <div className="mt-6 pt-5 hair-t">
                    <p className="text-faint mb-2">{plural(result.citations.length, "source")}</p>
                    <ul className="flex flex-col gap-1.5">{result.citations.map((c) => <li key={c.url} className="flex items-center gap-2"><Favicon domain={c.domain} size={14} /><a className="truncate hover:underline" href={c.url} target="_blank" rel="noreferrer noopener">{c.url}</a></li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <Empty title="No check run yet" body="Pick a client, an engine and a prompt, then run one check. The answer, mention, rank, citations and exact cost show here." />
            )}
          </section>
        </div>

        <aside className="p-4 md:p-6 flex flex-col gap-6 hair-t lg:border-t-0">
          <div>
            <p className="text-ink font-medium mb-1">Test budget</p>
            <p className="text-faint mb-3">Hard cap set in the database. Every paid call is logged.</p>
            {isDemo ? (
              <p className="text-muted"><span className="tag tag-amber mr-1">Demo</span> Checks return sample answers and cost nothing.</p>
            ) : dfs ? (
              <>
                <div className="flex items-baseline justify-between mb-2 tnum"><span className="text-ink t-16 font-medium">{dfs.calls_used} of {dfs.calls_max}</span><span className="text-faint">checks used</span></div>
                <Meter value={dfs.calls_used} max={dfs.calls_max} label="Checks used" />
                <div className="flex items-baseline justify-between mt-4 mb-2 tnum"><span className="text-ink font-medium">{usd(dfs.spent_usd, 4)}</span><span className="text-faint">of {usd(dfs.max_spend_usd)} cap</span></div>
                <Meter value={dfs.spent_usd} max={dfs.max_spend_usd} label="Spend" />
              </>
            ) : <div className="skeleton h-20" />}
          </div>
          <div className="hair-t pt-5">
            <p className="text-ink font-medium mb-3">Connection</p>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center justify-between"><span className="text-muted">DataForSEO</span>{isDemo ? <span className="text-faint">Not used in demo</span> : dfs?.configured ? <LiveStatus label="Connected" tone="green" /> : <span className="text-warning-ink">Add function secrets</span>}</li>
              <li className="flex items-center justify-between"><span className="text-muted">Account balance</span><span className="tnum text-ink">{dfs?.balance_usd != null ? usd(dfs.balance_usd) : "–"}</span></li>
              <li className="flex items-center justify-between"><span className="text-muted">Endpoint</span><span className="text-faint">LLM Responses · live</span></li>
            </ul>
          </div>
          <div className="hair-t pt-5">
            <p className="text-ink font-medium mb-3">Engines and models</p>
            <ul className="flex flex-col gap-2.5">
              {engines.map((e) => (
                <li key={e} className="flex items-center gap-2.5"><EngineLogo id={e} size={14} /><span className="text-body flex-1">{engineById(e)?.name}</span><span className="text-faint tnum">{ESTIMATE[e]}</span></li>
              ))}
            </ul>
            <p className="text-faint mt-3">Estimates. The exact cost DataForSEO bills comes back with each check.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
