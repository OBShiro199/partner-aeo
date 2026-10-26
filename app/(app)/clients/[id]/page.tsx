"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowSquareOut, Lightning, Pause, Play, Plus, Sparkle, Trash, X as XIcon } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { repo } from "@/lib/repo";
import { EngineLogo, engineById, liveEngineIds } from "@/lib/engines";
import { latest, outcomeOf, promptMatrix, summarize } from "@/lib/stats";
import { FlagIcon, regionByCode } from "@/lib/regions";
import { ago, INTENT_LABEL, INTENT_TAG, normaliseDomain, pct, plural, score } from "@/lib/format";
import { brandVariants } from "@/supabase/functions/_shared/analyse";
import type { Intent, Result } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { Outcome } from "@/components/outcome";
import { AnswerText } from "@/components/AnswerText";
import { RegionSelect } from "@/components/pickers";
import { Button, cx, Empty, Favicon, Field, LiveStatus } from "@/components/ui";
import { ScoreRing } from "@/components/charts";

const TABS = ["Prompts", "Answers", "Competitors", "Settings"] as const;

export default function Page() {
  return <Suspense><ClientPage /></Suspense>;
}

function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const s = useApp();
  const client = s.clients.find((c) => c.id === id);
  const [tab, setTab] = useState<(typeof TABS)[number]>(search.get("prompt") ? "Answers" : "Prompts");
  const engines = liveEngineIds(s.agency!.engines);
  const results = useMemo(() => s.results.filter((r) => r.client_id === id), [s.results, id]);
  const cur = useMemo(() => latest(results), [results]);
  const sum = summarize(cur);

  if (!client) {
    return (
      <>
        <Toolbar><Link href="/clients" className="text-muted inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Clients</Link></Toolbar>
        <Empty title="Client not found" body="It may have been deleted, or it belongs to another workspace." action={<Link href="/clients" className="btn">Back to clients</Link>} />
      </>
    );
  }

  return (
    <>
      <Toolbar right={<a href={`https://${client.domain}`} target="_blank" rel="noreferrer" className="btn btn-compact btn-ghost"><ArrowSquareOut size={14} /> Visit site</a>}>
        <Link href="/clients" className="text-muted hover:text-ink inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Clients</Link>
        <span className="text-ghost">/</span>
        <span className="text-ink font-medium truncate">{client.name}</span>
      </Toolbar>

      <section className="relative hair-b overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000, transparent)" }} aria-hidden />
        <div className="relative px-4 md:px-6 pt-7 pb-5 flex flex-wrap items-center gap-5">
          <Favicon src={client.favicon_url} domain={client.domain} name={client.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="h1 truncate">{client.name}</h1>
              {client.status === "paused" && <span className="tag">Paused</span>}
            </div>
            <p className="text-muted mt-1 flex items-center gap-2 flex-wrap">
              {client.domain} <span className="text-ghost">·</span> <FlagIcon code={client.region} size={14} /> {regionByCode(client.region)?.name}
              <span className="text-ghost">·</span> {plural(s.prompts.filter((p) => p.client_id === id && p.active).length, "prompt")}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="relative">
                <ScoreRing value={sum.visibility} size={52} />
                <span className="absolute inset-0 grid place-items-center text-ink font-medium tnum">{score(sum.visibility)}</span>
              </span>
              <span className="text-faint leading-tight">Visibility<br />score</span>
            </div>
            <Stat label="Mentions" value={pct(sum.mentionRate)} />
            <Stat label="Citations" value={pct(sum.citationRate)} />
            <Stat label="Avg. position" value={sum.avgPosition ? sum.avgPosition.toFixed(1) : "–"} />
          </div>
        </div>
        <div className="relative px-4 md:px-6 flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cx("h-10 px-3 -mb-px border-b-2 transition-colors", tab === t ? "border-ink text-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <div key={tab} className="fade-in">
        {tab === "Prompts" && <PromptsTab clientId={id} engines={engines} current={cur} onOpen={() => setTab("Answers")} />}
        {tab === "Answers" && <AnswersTab clientId={id} results={results} engines={engines} initialPrompt={search.get("prompt")} initialEngine={search.get("engine")} />}
        {tab === "Competitors" && <CompetitorsTab clientId={id} current={cur} />}
        {tab === "Settings" && <SettingsTab clientId={id} />}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <p className="text-ink font-medium tnum t-16">{value}</p>
      <p className="text-faint">{label}</p>
    </div>
  );
}

function PromptsTab({ clientId, engines, current, onOpen }: { clientId: string; engines: string[]; current: Result[]; onOpen: () => void }) {
  const s = useApp();
  const client = s.clients.find((c) => c.id === clientId)!;
  const all = s.prompts.filter((p) => p.client_id === clientId).sort((a, b) => Number(b.active) - Number(a.active) || a.position - b.position);
  const active = all.filter((p) => p.active);
  const matrix = promptMatrix(all, current, engines);
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<Intent>("best_for");
  const [gen, setGen] = useState(false);

  async function suggest() {
    setGen(true);
    try {
      const comps = s.competitors.filter((c) => c.client_id === clientId).map((c) => c.name);
      const g = await repo.generatePrompts(s.agency!.id, { name: client.name, domain: client.domain, description: client.description, region: client.region, competitors: comps }, 10);
      const existing = new Set(all.map((p) => p.text.toLowerCase()));
      const fresh = g.prompts.filter((p) => !existing.has(p.text.toLowerCase())).slice(0, Math.max(0, 10 - active.length));
      for (const p of fresh) await s.addPrompt(clientId, p.text, p.intent);
      s.toast(fresh.length ? `${plural(fresh.length, "prompt")} added` : "No new prompts to add");
    } catch (e) {
      s.toast((e as Error).message, { tone: "error" });
    } finally {
      setGen(false);
    }
  }

  return (
    <div>
      <div className="h-[44px] hair-b flex items-center gap-3 px-4 md:px-6">
        <span className="text-faint">{active.length}/10 active</span>
        <span className="text-ghost">·</span>
        <span className="text-faint hidden sm:inline">Click a dot to read that answer. Use <Lightning size={12} className="inline -mt-0.5" /> to run one live check.</span>
        <Button size="compact" className="ml-auto" onClick={suggest} loading={gen} disabled={active.length >= 10} minWidth={150}>
          <Sparkle size={14} weight="duotone" className="text-blue" /> Suggest prompts
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th>Prompt</th>
              <th style={{ width: 124 }}>Intent</th>
              {engines.map((e) => <th key={e} style={{ width: 104 }} className="text-center"><span className="inline-flex items-center gap-1.5"><EngineLogo id={e} size={13} />{engineById(e)?.short}</span></th>)}
              <th style={{ width: 84 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {matrix.map((m, i) => (
              <tr key={m.prompt.id} className={cx("group rise", !m.prompt.active && "opacity-55")} style={{ animationDelay: `${Math.min(i * 25, 270)}ms` }}>
                <td className="text-ink">{m.prompt.text}</td>
                <td><span className={cx("tag", INTENT_TAG[m.prompt.intent])}>{INTENT_LABEL[m.prompt.intent]}</span></td>
                {m.cells.map((c) => {
                  const key = `${m.prompt.id}|${c.engine}`;
                  const running = s.checking[key];
                  return (
                    <td key={c.engine} className="text-center">
                      <span className="inline-flex items-center gap-1.5 w-[60px] justify-center">
                        {running ? <span className="live-dot" aria-label="Checking" /> : (
                          <button onClick={onOpen} className="inline-flex" aria-label="Read answer"><Outcome outcome={c.outcome} position={c.result?.position ?? null} /></button>
                        )}
                        <button
                          aria-label={`Run a live check on ${engineById(c.engine)?.name}`}
                          title={`Run on ${engineById(c.engine)?.name}`}
                          disabled={!!running || !m.prompt.active || Object.keys(s.checking).length > 0}
                          onClick={async () => {
                            const r = await s.runCheck({ promptId: m.prompt.id, clientId, engine: c.engine });
                            if (r) s.toast(`${engineById(c.engine)?.name}: ${r.mentioned ? `mentioned${r.position ? ` at #${r.position}` : ""}` : "not mentioned"}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 text-faint hover:text-blue transition-opacity"
                          style={{ visibility: running ? "hidden" : "visible" }}
                        >
                          <Lightning size={13} weight="fill" />
                        </button>
                      </span>
                    </td>
                  );
                })}
                <td>
                  <span className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn btn-ghost btn-icon h-7 w-7" aria-label={m.prompt.active ? "Pause prompt" : "Resume prompt"}
                      onClick={() => s.updatePrompt(m.prompt.id, { active: !m.prompt.active }).catch((e) => s.toast(e.message, { tone: "error" }))}>
                      {m.prompt.active ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-icon h-7 w-7 hover:text-danger-ink" aria-label="Delete prompt"
                      onClick={() => s.deletePrompt(m.prompt.id).then(() => s.toast("Prompt deleted"))}>
                      <Trash size={14} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="px-4 md:px-6 py-4 flex flex-wrap gap-2 items-center"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim().length < 3) return;
          try { await s.addPrompt(clientId, text.trim(), intent); setText(""); s.toast("Prompt added"); } catch (err) { s.toast((err as Error).message, { tone: "error" }); }
        }}
      >
        <input className="input flex-1 min-w-[240px]" placeholder={`e.g. Best ${client.industry ?? "option"} in ${regionByCode(client.region)?.name ?? "my area"}`} value={text} onChange={(e) => setText(e.target.value)} disabled={active.length >= 10} />
        <div className="flex gap-1">
          {(Object.keys(INTENT_LABEL) as Intent[]).map((k) => (
            <button type="button" key={k} className="chip h-9" aria-pressed={intent === k} onClick={() => setIntent(k)}>{INTENT_LABEL[k]}</button>
          ))}
        </div>
        <Button type="submit" disabled={active.length >= 10}><Plus size={14} /> Add prompt</Button>
      </form>
    </div>
  );
}

function AnswersTab({ clientId, results, engines, initialPrompt, initialEngine }: { clientId: string; results: Result[]; engines: string[]; initialPrompt: string | null; initialEngine: string | null }) {
  const s = useApp();
  const client = s.clients.find((c) => c.id === clientId)!;
  const comps = s.competitors.filter((c) => c.client_id === clientId);
  const [engine, setEngine] = useState<string | null>(initialEngine);
  const [show, setShow] = useState<"all" | "mentioned" | "missed">("all");
  const [promptId, setPromptId] = useState<string | null>(initialPrompt);
  const list = results
    .filter((r) => (!engine || r.engine === engine) && (!promptId || r.prompt_id === promptId) && (show === "all" || (show === "mentioned" ? r.mentioned : r.status === "done" && !r.mentioned)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 60);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (initialPrompt && list[0]) setOpen(list[0].id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = list.find((r) => r.id === open) ?? list[0];
  const prompt = s.prompts.find((p) => p.id === promptId);

  return (
    <div>
      <div className="h-[44px] hair-b flex items-center gap-1.5 px-4 md:px-6 overflow-x-auto no-scrollbar">
        {prompt && <span className="chip h-7" data-active="true">“{prompt.text.slice(0, 40)}{prompt.text.length > 40 ? "…" : ""}”<button aria-label="Clear prompt filter" onClick={() => setPromptId(null)}><XIcon size={11} /></button></span>}
        <button className="chip h-7" aria-pressed={!engine} onClick={() => setEngine(null)}>All engines</button>
        {engines.map((e) => <button key={e} className="chip h-7" aria-pressed={engine === e} onClick={() => setEngine(e)}><EngineLogo id={e} size={13} />{engineById(e)?.name}</button>)}
        <span className="w-px h-5 bg-hairline mx-1" />
        {(["all", "mentioned", "missed"] as const).map((k) => <button key={k} className="chip h-7 capitalize" aria-pressed={show === k} onClick={() => setShow(k)}>{k}</button>)}
      </div>
      {!list.length ? <Empty title="No answers yet" body="Run a live check from the Prompts tab, or wait for the next scan." /> : (
        <div className="grid lg:grid-cols-[minmax(280px,380px)_1fr]">
          <ul className="lg:hair-r max-h-[calc(100dvh-280px)] overflow-y-auto">
            {list.map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpen(r.id)} className={cx("w-full text-left px-4 md:px-6 py-3 hair-b border-divider flex gap-3 transition-colors", sel?.id === r.id ? "bg-blue-soft/60" : "hover:bg-row-hover")}>
                  <span className="pt-0.5"><Outcome outcome={outcomeOf(r)} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink truncate">{r.prompt_text}</span>
                    <span className="flex items-center gap-1.5 text-faint mt-0.5"><EngineLogo id={r.engine} size={12} />{engineById(r.engine)?.name} · {ago(r.created_at)}{r.position ? ` · #${r.position}` : ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sel && (
            <article className="p-4 md:p-8 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="tag"><EngineLogo id={sel.engine} size={12} /> {engineById(sel.engine)?.name}{sel.model ? ` · ${sel.model}` : ""}</span>
                <span className={cx("tag", sel.mentioned ? "tag-green" : sel.status === "failed" ? "" : "tag-red")}>{sel.status === "failed" ? "Failed" : sel.mentioned ? `Mentioned${sel.position ? ` · #${sel.position}` : ""}` : "Not mentioned"}</span>
                {sel.own_domain_cited && <span className="tag tag-blue">Site cited</span>}
                {sel.cost_usd > 0 && <span className="tag tnum">${sel.cost_usd.toFixed(4)}</span>}
                <span className="text-faint ml-auto">{new Date(sel.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
              <h2 className="h3 mb-5">{sel.prompt_text}</h2>
              {sel.status === "failed" ? <p className="text-danger-ink">{sel.error ?? "The engine didn't answer."}</p> : (
                <LazyAnswer key={sel.id} result={sel} brand={brandVariants(client.name, client.domain, client.aliases)} competitors={comps.map((c) => c.name)} />
              )}
              {sel.competitors_mentioned.length > 0 && (
                <p className="mt-6 text-muted">Competitors named: {sel.competitors_mentioned.map((c) => <span key={c} className="tag tag-amber mr-1">{c}</span>)}</p>
              )}
              {sel.citations.length > 0 && (
                <div className="mt-6 pt-5 hair-t">
                  <p className="text-faint mb-3">{plural(sel.citations.length, "source")} cited</p>
                  <ul className="flex flex-col gap-2">
                    {sel.citations.map((c) => (
                      <li key={c.url} className="flex items-center gap-2.5 min-w-0">
                        <Favicon domain={c.domain} size={16} />
                        <a href={c.url} target="_blank" rel="noreferrer noopener" className={cx("truncate hover:underline", c.domain === client.domain ? "text-blue-ink font-medium" : "text-body")}>{c.title ?? c.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitorsTab({ clientId, current }: { clientId: string; current: Result[] }) {
  const s = useApp();
  const comps = s.competitors.filter((c) => c.client_id === clientId);
  const [name, setName] = useState("");
  const done = current.filter((r) => r.status === "done");
  const own = done.filter((r) => r.mentioned).length;
  return (
    <div className="max-w-[760px] px-4 md:px-6 py-6">
      <p className="text-muted mb-4">We check every answer for these names. Up to 5 per client.</p>
      <ul className="card divide-y divide-divider">
        <li className="h-12 flex items-center gap-3 px-4">
          <span className="tag tag-blue">You</span>
          <span className="text-ink font-medium flex-1">{s.clients.find((c) => c.id === clientId)?.name}</span>
          <span className="tnum text-faint">{own} of {done.length} answers</span>
        </li>
        {comps.map((c) => {
          const n = done.filter((r) => r.competitors_mentioned.includes(c.name)).length;
          return (
            <li key={c.id} className="h-12 flex items-center gap-3 px-4 group">
              <Favicon domain={c.domain} name={c.name} size={18} />
              <span className="text-ink flex-1 truncate">{c.name}</span>
              <span className="tnum text-faint">{n} of {done.length} answers</span>
              <button className="btn btn-ghost btn-icon h-7 w-7 opacity-0 group-hover:opacity-100" aria-label={`Remove ${c.name}`}
                onClick={() => s.setCompetitors(clientId, comps.filter((x) => x.id !== c.id).map(({ name, domain }) => ({ name, domain })))}>
                <Trash size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <form className="flex gap-2 mt-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || comps.length >= 5) return;
        await s.setCompetitors(clientId, [...comps.map(({ name, domain }) => ({ name, domain })), { name: name.trim(), domain: normaliseDomain(name) }]);
        setName("");
        s.toast("Competitor added");
      }}>
        <input className="input" placeholder="Competitor name or domain" value={name} onChange={(e) => setName(e.target.value)} disabled={comps.length >= 5} />
        <Button type="submit" disabled={comps.length >= 5}><Plus size={14} /> Add</Button>
      </form>
    </div>
  );
}

function SettingsTab({ clientId }: { clientId: string }) {
  const s = useApp();
  const router = useRouter();
  const c = s.clients.find((x) => x.id === clientId)!;
  const [name, setName] = useState(c.name);
  const [desc, setDesc] = useState(c.description ?? "");
  const [aliases, setAliases] = useState(c.aliases.join(", "));
  const [region, setRegion] = useState(c.region);
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-[640px] px-4 md:px-6 py-6 flex flex-col gap-5">
      <Field label="Brand name" htmlFor="cs-name"><input id="cs-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Other spellings" hint="Comma separated. Counted as mentions too, e.g. 'Acme CRM, AcmeHQ'." htmlFor="cs-alias"><input id="cs-alias" className="input" value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
      <Field label="What they sell" htmlFor="cs-desc"><input id="cs-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label="Main market" htmlFor="cs-region"><RegionSelect id="cs-region" value={region} onChange={setRegion} /></Field>
      <div className="flex gap-2">
        <Button variant="primary" loading={busy} onClick={async () => {
          setBusy(true);
          try {
            await s.updateClient(clientId, { name: name.trim(), description: desc || null, region, aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean) });
            s.toast("Client saved");
          } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setBusy(false); }
        }}>Save changes</Button>
      </div>
      <div className="mt-6 pt-6 hair-t flex items-center justify-between gap-4">
        <div>
          <p className="text-ink font-medium">Delete client</p>
          <p className="text-faint">Removes its prompts and every saved answer.</p>
        </div>
        <Button variant="danger" onClick={async () => {
          if (!confirm(`Delete ${c.name} and all its history? This can't be undone.`)) return;
          await s.deleteClient(clientId);
          s.toast(`${c.name} deleted`);
          router.replace("/clients");
        }}><Trash size={14} /> Delete</Button>
      </div>
      <LiveStatus label={`Created ${ago(c.created_at).toLowerCase()}`} tone="green" />
    </div>
  );
}

// Answer text isn't part of the workspace load; fetch it the first time an answer is opened.
const textCache = new Map<string, string>();
function LazyAnswer({ result, brand, competitors }: { result: Result; brand: string[]; competitors: string[] }) {
  const [text, setText] = useState<string | null>(result.response_text ?? textCache.get(result.id) ?? null);
  useEffect(() => {
    if (text != null) return;
    let live = true;
    repo.resultText(result.id).then((t) => { textCache.set(result.id, t ?? ""); if (live) setText(t ?? ""); }).catch(() => live && setText(""));
    return () => { live = false; };
  }, [result.id, text]);
  if (text == null) return <div className="flex flex-col gap-2.5" aria-busy><div className="skeleton h-4 w-11/12" /><div className="skeleton h-4 w-9/12" /><div className="skeleton h-4 w-10/12" /></div>;
  return text ? <AnswerText text={text} brand={brand} competitors={competitors} /> : <p className="text-muted">No answer text was stored for this check.</p>;
}
