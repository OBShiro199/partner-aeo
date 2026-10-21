"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown, Check, Compass, Plus, UsersThree, ArrowUpRight } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { isDemo } from "@/lib/repo";
import { ENGINES, EngineLogo, engineById, liveEngineIds } from "@/lib/engines";
import { byEngine, clientTable, inRange, latest, promptMatrix, shareOfVoice, summarize, topSources, weeklyTrend } from "@/lib/stats";
import { ago, INTENT_LABEL, INTENT_TAG, pct, plural, score } from "@/lib/format";
import { Toolbar } from "@/components/shell/Toolbar";
import { Bar, TrendChart } from "@/components/charts";
import { Tour, useTour } from "@/components/Tour";
import { Button, cx, Delta, Empty, Favicon, LiveStatus, Menu, Sparkline } from "@/components/ui";
import { Outcome as OutcomeDot } from "@/components/outcome";

export default function Dashboard() {
  const s = useApp();
  const tour = useTour();
  const engines = liveEngineIds(s.agency!.engines);
  const shownEngines = s.engineFilter.length ? engines.filter((e) => s.engineFilter.includes(e)) : engines;
  const client = s.clients.find((c) => c.id === s.filterClient) ?? null;

  const scoped = useMemo(
    () => s.results.filter((r) => (!client || r.client_id === client.id) && shownEngines.includes(r.engine)),
    [s.results, client, shownEngines],
  );
  const current = useMemo(() => latest(scoped.filter((r) => inRange(r, s.rangeDays))), [scoped, s.rangeDays]);
  const previous = useMemo(() => {
    const d = s.rangeDays * 86_400_000;
    return latest(scoped.filter((r) => { const a = nowMs() - new Date(r.created_at).getTime(); return a > d && a <= 2 * d; }));
  }, [scoped, s.rangeDays]);
  const sum = summarize(current);
  const prev = summarize(previous);
  const trend = useMemo(() => weeklyTrend(scoped, s.rangeDays === 90 ? 13 : 8), [scoped, s.rangeDays]);
  const engineRows = byEngine(current, shownEngines);
  const lastChecked = scoped.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);
  const activePrompts = s.prompts.filter((p) => p.active && (!client || p.client_id === client.id));

  if (!s.clients.length) {
    return (
      <>
        <Toolbar><span className="text-ink font-medium">Dashboard</span></Toolbar>
        <Empty
          icon={<UsersThree size={18} />}
          title="Add your first client"
          body="Paste a client's domain. We read their site, write the prompts their buyers ask AI, and start tracking every engine you chose."
          action={<Button variant="primary" onClick={() => s.setAddClientOpen(true)}><Plus size={14} /> Add client</Button>}
        />
      </>
    );
  }

  const first = s.user?.full_name?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <Toolbar
        right={
          <>
            <Button size="compact" variant="ghost" onClick={tour.start}><Compass size={15} /> Tour</Button>
            <Button size="compact" variant="primary" onClick={() => s.setAddClientOpen(true)} className="hidden sm:inline-flex"><Plus size={14} className="text-blue" /> Add client</Button>
          </>
        }
      >
        <ClientFilter />
        <div className="hidden md:flex items-center rounded-md border border-hairline p-0.5" role="group" aria-label="Date range">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => s.setRange(d)} aria-pressed={s.rangeDays === d}
              className={cx("h-7 px-2.5 rounded-[4px] tnum transition-colors", s.rangeDays === d ? "bg-blue-soft text-blue-ink font-medium" : "text-muted hover:text-ink")}>
              {d}d
            </button>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {engines.map((e) => (
            <button key={e} className="chip h-7" aria-pressed={s.engineFilter.includes(e)} onClick={() => s.toggleEngine(e)}>
              <EngineLogo id={e} size={13} mono={!s.engineFilter.includes(e) && s.engineFilter.length > 0} />
              {engineById(e)?.name}
            </button>
          ))}
        </div>
      </Toolbar>

      <div className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden hair-b">
          <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000, transparent)" }} aria-hidden />
          <div className="relative px-4 md:px-6 pt-7 pb-6 flex flex-wrap items-end gap-4 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {client ? <Favicon src={client.favicon_url} domain={client.domain} name={client.name} size={20} /> : null}
                <LiveStatus label={`Tracking ${plural(activePrompts.length, "prompt")} on ${plural(shownEngines.length, "engine")}`} tone="green" />
              </div>
              <h1 className="h1">{client ? client.name : first ? `${greeting}, ${first}` : greeting}</h1>
              <p className="text-muted mt-1.5 t-14">
                {client
                  ? <>{client.domain} · last checked {ago(lastChecked).toLowerCase()}</>
                  : <>{plural(s.clients.length, "client")} across {plural(shownEngines.length, "answer engine")}. Last checked {ago(lastChecked).toLowerCase()}.</>}
              </p>
            </div>
            {isDemo && <span className="tag tag-amber">Sample data</span>}
          </div>
        </section>

        <Checklist onTour={tour.start} />

        {/* KPIs */}
        <section data-tour="kpis" className="grid grid-cols-2 lg:grid-cols-4 hair-b">
          <Kpi label="Visibility score" hint="70% mentions, 30% citations" value={score(sum.visibility)} delta={sum.visibility != null && prev.visibility != null ? sum.visibility - prev.visibility : null} spark={trend.map((t) => t.value)} big />
          <Kpi label="Mention rate" hint={`${sum.mentions} of ${sum.answers} answers name ${client ? "the brand" : "a client"}`} value={pct(sum.mentionRate)} delta={sum.mentionRate != null && prev.mentionRate != null ? (sum.mentionRate - prev.mentionRate) * 100 : null} />
          <Kpi label="Citation rate" hint="Answers that link to the client's site" value={pct(sum.citationRate)} delta={sum.citationRate != null && prev.citationRate != null ? (sum.citationRate - prev.citationRate) * 100 : null} />
          <Kpi label="Average position" hint="Rank when the answer is a list" value={sum.avgPosition == null ? "–" : sum.avgPosition.toFixed(1)} delta={sum.avgPosition != null && prev.avgPosition != null ? prev.avgPosition - sum.avgPosition : null} />
        </section>

        {/* Trend + engines */}
        <section className="grid grid-cols-1 xl:grid-cols-3 hair-b">
          <div className="xl:col-span-2 xl:hair-r p-4 md:p-6">
            <PanelHead title="Visibility over time" sub={`Weekly, ${client ? client.name : "all clients"}`} />
            <TrendChart data={trend} height={220} />
          </div>
          <div data-tour="engines" className="p-4 md:p-6 hair-t xl:border-t-0">
            <PanelHead title="By engine" sub="Mention rate in this period" />
            <ul className="flex flex-col gap-4 mt-1">
              {engineRows.map((e) => (
                <li key={e.id}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <EngineLogo id={e.id} size={15} />
                    <span className="text-ink font-medium">{engineById(e.id)?.name}</span>
                    <span className="ml-auto tnum text-ink">{pct(e.mentionRate)}</span>
                    <span className="tnum text-faint w-16 text-right">{e.answers} ans.</span>
                  </div>
                  <Bar value={e.mentionRate} label={`${engineById(e.id)?.name} mention rate`} />
                </li>
              ))}
            </ul>
            <ComingSoon />
          </div>
        </section>

        {client ? <ClientDetail clientId={client.id} engines={shownEngines} current={current} /> : <Book engines={shownEngines} />}

        <footer className="px-4 md:px-6 py-6 text-faint">
          Answers come from each engine&apos;s API with web search on, via DataForSEO. They approximate, but aren&apos;t identical to, what a signed-in consumer sees.
        </footer>
      </div>
      <Tour open={tour.open} onDone={tour.done} />
    </>
  );
}

function PanelHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="t-14 font-medium text-ink">{title}</h2>
        {sub && <p className="text-faint mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Kpi({ label, hint, value, delta, spark, big }: { label: string; hint: string; value: string; delta: number | null; spark?: (number | null)[]; big?: boolean }) {
  return (
    <div className="p-4 md:p-6 hair-r last:border-r-0 [&:nth-child(2)]:max-lg:border-r-0 max-lg:[&:nth-child(-n+2)]:hair-b">
      <p className="text-faint">{label}</p>
      <div className="flex items-end gap-3 mt-2">
        <span className={cx("text-ink tnum font-medium tracking-[-0.04em]", big ? "text-[40px] leading-[44px]" : "text-[32px] leading-[40px]")}>{value}</span>
        <span className="pb-1.5"><Delta value={delta} /></span>
        {spark && <span className="ml-auto pb-1.5 hidden sm:block"><Sparkline values={spark} /></span>}
      </div>
      <p className="text-faint mt-1.5 truncate">{hint}</p>
    </div>
  );
}

function ComingSoon() {
  const soon = ENGINES.filter((e) => !e.live).slice(0, 6);
  return (
    <div className="mt-6 pt-4 hair-t flex items-center gap-2 text-faint">
      <span className="flex -space-x-1">
        {soon.map((e) => <span key={e.id} className="size-5 rounded-full bg-surface grid place-items-center" style={{ boxShadow: "0 0 0 1px var(--hairline)" }}><EngineLogo id={e.id} size={11} mono /></span>)}
      </span>
      More engines coming soon*
    </div>
  );
}

function ClientFilter() {
  const clients = useApp((s) => s.clients);
  const id = useApp((s) => s.filterClient);
  const set = useApp((s) => s.setFilterClient);
  const cur = clients.find((c) => c.id === id);
  const [q, setQ] = useState("");
  const list = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.includes(q.toLowerCase()));
  return (
    <Menu
      width={280}
      trigger={(p) => (
        <button {...p} data-tour="client-filter" className="btn btn-compact" style={{ width: 200, justifyContent: "flex-start" }}>
          {cur ? <Favicon src={cur.favicon_url} domain={cur.domain} name={cur.name} size={16} /> : <UsersThree size={15} className="text-faint" />}
          <span className="truncate flex-1 text-left">{cur?.name ?? "All clients"}</span>
          <CaretDown size={12} className="text-faint" />
        </button>
      )}
    >
      {(close) => (
        <>
          {clients.length > 6 && <input autoFocus className="input h-8 mb-1" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />}
          <button className="menu-item" data-active={!id} onClick={() => { set(null); close(); }}>
            <UsersThree size={16} className="text-faint" /> <span className="flex-1">All clients</span> {!id && <Check size={14} className="text-blue" />}
          </button>
          <div className="h-px bg-divider my-1" />
          <div className="max-h-[280px] overflow-y-auto">
            {list.map((c) => (
              <button key={c.id} className="menu-item" data-active={c.id === id} onClick={() => { set(c.id); close(); }}>
                <Favicon src={c.favicon_url} domain={c.domain} name={c.name} size={16} />
                <span className="flex-1 truncate">{c.name}</span>
                {c.id === id && <Check size={14} className="text-blue" />}
              </button>
            ))}
          </div>
        </>
      )}
    </Menu>
  );
}

type SortKey = "name" | "visibility" | "delta" | "mentionRate" | "citationRate";
type Sort = { key: SortKey; dir: 1 | -1 };

const nowMs = () => Date.now();

function Th({ k, children, w, sort, setSort }: { k: SortKey; children: React.ReactNode; w?: number; sort: Sort; setSort: (s: Sort) => void }) {
  return (
    <th style={{ width: w }} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className={cx("inline-flex items-center gap-1 hover:text-ink", sort.key === k && "text-ink")} onClick={() => setSort({ key: k, dir: sort.key === k ? (sort.dir === 1 ? -1 : 1) : -1 })}>
        {children}
        <span className="w-2 text-[10px]">{sort.key === k ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}

function Book({ engines }: { engines: string[] }) {
  const s = useApp();
  const [sort, setSort] = useState<Sort>({ key: "visibility", dir: -1 });
  const rows = useMemo(() => {
    const t = clientTable(s.clients, s.results.filter((r) => engines.includes(r.engine)), s.rangeDays);
    return t.sort((a, b) => {
      const av = sort.key === "name" ? a.client.name : a[sort.key];
      const bv = sort.key === "name" ? b.client.name : b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [s.clients, s.results, engines, s.rangeDays, sort]);

  const movers = [...rows].filter((r) => r.delta != null).sort((a, b) => a.delta! - b.delta!);
  const sources = topSources(latest(s.results.filter((r) => engines.includes(r.engine) && inRange(r, s.rangeDays))), 6);


  return (
    <>
      <section data-tour="clients-table" className="hair-b">
        <div className="px-4 md:px-6 pt-6"><PanelHead title="Clients" sub="Newest answer per prompt and engine in this period" right={<Link href="/clients" className="text-muted hover:text-ink inline-flex items-center gap-1">Manage <ArrowRight size={12} /></Link>} /></div>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <Th sort={sort} setSort={setSort} k="name" w={260}>Client</Th>
                <Th sort={sort} setSort={setSort} k="visibility" w={130}>Visibility</Th>
                <Th sort={sort} setSort={setSort} k="delta" w={90}>Change</Th>
                <Th sort={sort} setSort={setSort} k="mentionRate" w={120}>Mentions</Th>
                <Th sort={sort} setSort={setSort} k="citationRate" w={110}>Citations</Th>
                <th style={{ width: 120 }}>8 weeks</th>
                <th style={{ width: 110 }}>Checked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.client.id} className="rise cursor-pointer" style={{ animationDelay: `${Math.min(i * 25, 270)}ms` }} onClick={() => s.setFilterClient(r.client.id)}>
                  <td>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Favicon src={r.client.favicon_url} domain={r.client.domain} name={r.client.name} size={22} />
                      <span className="min-w-0">
                        <span className="block text-ink font-medium truncate">{r.client.name}</span>
                        <span className="block text-faint truncate t-12">{r.client.domain}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="tnum text-ink font-medium w-6">{score(r.visibility)}</span>
                      <span className="flex-1 max-w-[60px]"><Bar value={r.visibility != null ? r.visibility / 100 : null} /></span>
                    </span>
                  </td>
                  <td><Delta value={r.delta} /></td>
                  <td className="tnum">{pct(r.mentionRate)}</td>
                  <td className="tnum">{pct(r.citationRate)}</td>
                  <td><Sparkline values={r.spark} /></td>
                  <td className="text-faint">{ago(r.lastChecked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 hair-b">
        <div className="p-4 md:p-6 lg:hair-r">
          <PanelHead title="Needs attention" sub="Biggest drops versus the previous period" />
          {movers.filter((m) => m.delta! < 0).length ? (
            <ul className="flex flex-col">
              {movers.filter((m) => m.delta! < 0).slice(0, 5).map((m) => (
                <li key={m.client.id} className="h-11 flex items-center gap-3 hair-b last:border-b-0 border-divider">
                  <Favicon src={m.client.favicon_url} domain={m.client.domain} name={m.client.name} size={18} />
                  <span className="text-ink truncate flex-1">{m.client.name}</span>
                  <span className="tnum text-faint">{score(m.visibility)}</span>
                  <span className="w-10 text-right"><Delta value={m.delta} /></span>
                  <button className="btn btn-compact btn-ghost" onClick={() => s.setFilterClient(m.client.id)} aria-label={`Open ${m.client.name}`}><ArrowUpRight size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">No client dropped this period.</p>}
        </div>
        <div className="p-4 md:p-6">
          <PanelHead title="Most cited sources" sub="Sites AI leans on when answering your clients' prompts" />
          <Sources rows={sources} />
        </div>
      </section>
    </>
  );
}

function Sources({ rows }: { rows: { domain: string; count: number; rate: number }[] }) {
  if (!rows.length) return <p className="text-muted">No citations yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.domain} className="flex items-center gap-3">
          <Favicon domain={r.domain} size={16} />
          <span className="text-ink truncate w-36">{r.domain}</span>
          <span className="flex-1"><Bar value={r.rate} tone="grey" /></span>
          <span className="tnum text-faint w-20 text-right">{plural(r.count, "answer")}</span>
        </li>
      ))}
    </ul>
  );
}

function ClientDetail({ clientId, engines, current }: { clientId: string; engines: string[]; current: ReturnType<typeof latest> }) {
  const s = useApp();
  const client = s.clients.find((c) => c.id === clientId)!;
  const prompts = s.prompts.filter((p) => p.client_id === clientId && p.active);
  const matrix = promptMatrix(prompts, current, engines);
  const sov = shareOfVoice(current, [client], s.competitors.filter((c) => c.client_id === clientId)).slice(0, 6);
  const leader = sov[0];

  return (
    <>
      <section className="hair-b">
        <div className="px-4 md:px-6 pt-6">
          <PanelHead title="Prompts by engine" sub="Newest answer for each prompt" right={<Link href={`/clients/${clientId}`} className="text-muted hover:text-ink inline-flex items-center gap-1">Open client <ArrowRight size={12} /></Link>} />
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Prompt</th>
                <th style={{ width: 124 }}>Intent</th>
                {engines.map((e) => <th key={e} style={{ width: 92 }} className="text-center"><span className="inline-flex items-center gap-1.5"><EngineLogo id={e} size={13} />{engineById(e)?.short}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((m, i) => (
                <tr key={m.prompt.id} className="rise" style={{ animationDelay: `${Math.min(i * 25, 270)}ms` }}>
                  <td className="text-ink">{m.prompt.text}</td>
                  <td><span className={cx("tag", INTENT_TAG[m.prompt.intent])}>{INTENT_LABEL[m.prompt.intent]}</span></td>
                  {m.cells.map((c) => (
                    <td key={c.engine} className="text-center">
                      <Link href={`/clients/${clientId}?prompt=${m.prompt.id}&engine=${c.engine}`} className="inline-flex"><OutcomeDot outcome={c.outcome} position={c.result?.position ?? null} /></Link>
                    </td>
                  ))}
                </tr>
              ))}
              {!matrix.length && <tr><td colSpan={2 + engines.length} className="text-muted">No active prompts. Add some on the client page.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 md:px-6 py-3 flex flex-wrap gap-4 text-faint">
          <span className="inline-flex items-center gap-1.5"><OutcomeDot outcome="win" /> Top 3 or named</span>
          <span className="inline-flex items-center gap-1.5"><OutcomeDot outcome="partial" /> Lower down or site cited</span>
          <span className="inline-flex items-center gap-1.5"><OutcomeDot outcome="loss" /> Not mentioned</span>
          <span className="inline-flex items-center gap-1.5"><OutcomeDot outcome="pending" /> Not checked</span>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 hair-b">
        <div className="p-4 md:p-6 lg:hair-r">
          <PanelHead title="Share of voice" sub={leader && !leader.own ? `${leader.name} is named most often` : `${client.name} leads its competitors`} />
          <ul className="flex flex-col gap-3">
            {sov.map((x) => (
              <li key={x.name} className="flex items-center gap-3">
                <Favicon domain={x.domain} name={x.name} size={16} />
                <span className={cx("truncate w-36", x.own ? "text-ink font-medium" : "text-body")}>{x.name}</span>
                <span className="flex-1"><Bar value={x.share} tone={x.own ? "blue" : "grey"} /></span>
                <span className="tnum text-faint w-12 text-right">{pct(x.share)}</span>
              </li>
            ))}
          </ul>
          {sov.length <= 1 && <p className="text-muted mt-3">Add competitors on the client page to compare.</p>}
        </div>
        <div className="p-4 md:p-6">
          <PanelHead title="Most cited sources" sub="Get listed on these to be recommended more" />
          <Sources rows={topSources(current, 6)} />
        </div>
      </section>
    </>
  );
}

function Checklist({ onTour }: { onTour: () => void }) {
  const s = useApp();
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && localStorage.getItem("paeo-checklist-hidden") === "1");
  const items = [
    { label: "Create your workspace", done: true },
    { label: "Add your first client", done: s.clients.length > 0 },
    { label: "Choose answer engines", done: s.agency!.engines.length > 0 },
    { label: "Run a live check", done: s.results.some((r) => r.created_at > (s.agency!.onboarded_at ?? s.agency!.created_at)), href: "/lab" },
    { label: "Invite a teammate", done: s.members.length + s.invites.length > 1, href: "/settings#team" },
    { label: "Take the tour", done: !!s.agency!.tour_completed_at, onClick: onTour },
  ];
  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;
  return (
    <section className="hair-b px-4 md:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="lg:w-[220px] flex-none">
        <p className="text-ink font-medium">Get set up</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-hover overflow-hidden"><div className="h-full bg-blue rounded-full" style={{ width: `${(done / items.length) * 100}%`, transition: "width 500ms var(--ease-morph)" }} /></div>
          <span className="tnum text-faint">{done}/{items.length}</span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2 flex-1">
        {items.map((i) => {
          const body = (
            <>
              <span className={cx("size-4 rounded-full grid place-items-center border flex-none", i.done ? "bg-blue border-blue" : "border-btn-edge")}>{i.done && <Check size={9} weight="bold" color="#fff" />}</span>
              <span className={i.done ? "text-faint line-through decoration-ghost" : "text-ink"}>{i.label}</span>
            </>
          );
          return (
            <li key={i.label}>
              {i.done ? <span className="chip border-divider">{body}</span>
                : i.href ? <Link href={i.href} className="chip">{body}</Link>
                : <button className="chip" onClick={i.onClick}>{body}</button>}
            </li>
          );
        })}
      </ul>
      <button className="text-faint hover:text-ink self-start lg:self-center" onClick={() => { localStorage.setItem("paeo-checklist-hidden", "1"); setHidden(true); }}>Hide</button>
    </section>
  );
}
