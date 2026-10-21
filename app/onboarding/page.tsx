"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { ArrowLeft, ArrowRight, Check, Plus, Trash, Sparkle, ChartLineUp, UsersThree, Flask, Compass } from "@phosphor-icons/react";
import { Gate } from "@/components/gate";
import { Wordmark } from "@/components/brand";
import { Button, cx, Favicon, Field, LiveStatus } from "@/components/ui";
import { EnginePicker, RegionGrid } from "@/components/pickers";
import { useApp } from "@/lib/store";
import { repo } from "@/lib/repo";
import { CLIENT_BANDS } from "@/lib/regions";
import { EngineLogo, liveEngineIds, MAX_ENGINES } from "@/lib/engines";
import { faviconFor, nameFromDomain, normaliseDomain, plural } from "@/lib/format";
import type { NewClientInput } from "@/lib/types";

const STEPS = [
  { title: "Your agency", sub: "Size and markets" },
  { title: "Your website", sub: "Name and logo" },
  { title: "Answer engines", sub: `Up to ${MAX_ENGINES}` },
  { title: "Your clients", sub: "Their domains" },
  { title: "Launch", sub: "Set up tracking" },
];
const DRAFT_KEY = "paeo-onboarding";

type Draft = { step: number; band: string | null; regions: string[]; site: string; agencyName: string; engines: string[]; clients: string[] };
const initial: Draft = { step: 0, band: null, regions: ["GB"], site: "", agencyName: "", engines: ["chatgpt", "gemini", "claude", "perplexity"], clients: ["", "", ""] };

export default function OnboardingPage() {
  return (
    <Gate need="no-agency">
      <Onboarding />
    </Gate>
  );
}

function Onboarding() {
  const router = useRouter();
  const user = useApp((s) => s.user);
  const status = useApp((s) => s.status);
  const [d, setD] = useState<Draft>(() => {
    if (typeof window === "undefined") return initial;
    try { return { ...initial, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") }; } catch { return initial; }
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ domain: string; favicon_url: string } | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => { if (d.step < 4) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }, [d]);
  // An agency that already finished onboarding goes to the dashboard.
  useEffect(() => { if (status === "ready" && d.step < 4 && useApp.getState().agency?.onboarded_at) router.replace("/dashboard"); }, [status, d.step, router]);

  // Height morph for the step body.
  const body = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = body.current!;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function next() {
    setError(null);
    if (d.step === 0) {
      if (!d.band) return setError("Pick how many clients you manage.");
      if (!d.regions.length) return setError("Pick at least one market.");
    }
    if (d.step === 1) {
      const domain = normaliseDomain(d.site);
      if (!domain) return setError("Enter your agency's website, like youragency.com.");
      if (!meta || meta.domain !== domain) {
        setBusy(true);
        try {
          const m = await repo.siteMeta(domain);
          setMeta({ domain, favicon_url: m.favicon_url });
          if (!d.agencyName) set({ agencyName: m.name });
          setBusy(false);
          return; // show the preview first; next click continues
        } catch {
          setMeta({ domain, favicon_url: faviconFor(domain, 128) });
          if (!d.agencyName) set({ agencyName: nameFromDomain(domain) });
          setBusy(false);
          return;
        }
      }
      if (!d.agencyName.trim()) return setError("Add your agency's name.");
    }
    if (d.step === 2 && !liveEngineIds(d.engines).length) return setError("Pick at least one engine marked live: ChatGPT, Gemini, Claude or Perplexity.");
    if (d.step === 3) {
      const domains = d.clients.map(normaliseDomain).filter(Boolean);
      const bad = d.clients.filter((c) => c.trim() && !normaliseDomain(c));
      if (bad.length) return setError(`${bad[0]} doesn't look like a domain.`);
      if (!domains.length) return setError("Add at least one client domain. You can add more later.");
    }
    set({ step: d.step + 1 });
  }

  return (
    <div className="relative min-h-dvh flex flex-col">
      <div className="absolute inset-0 grid-bg grid-fade" aria-hidden />
      <header className="relative h-14 flex items-center justify-between px-5">
        <Wordmark />
        <span className="text-faint truncate">{user?.email}</span>
      </header>
      <main className="relative flex-1 flex items-start justify-center px-4 pt-[6vh] pb-16">
        <div className="w-full max-w-[860px] card overflow-hidden rise" style={{ boxShadow: "0 24px 64px rgba(8,9,10,.06), 0 1px 2px rgba(8,9,10,.04)" }}>
          <div className="grid md:grid-cols-[230px_1fr]">
            {/* Step rail */}
            <aside className="hair-b md:border-b-0 md:hair-r p-5 bg-row-hover/60">
              <p className="text-faint mb-4">Setup · {Math.min(d.step + 1, 5)} of 5</p>
              <ol className="flex md:flex-col gap-3 overflow-x-auto no-scrollbar">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex items-center gap-3 flex-none">
                    <span className={cx("size-[22px] rounded-full grid place-items-center border tnum t-12 transition-colors", i < d.step ? "bg-blue border-blue text-white" : i === d.step ? "border-blue text-blue-ink bg-surface" : "border-hairline text-faint bg-surface")}>
                      {i < d.step ? <Check size={11} weight="bold" /> : i + 1}
                    </span>
                    <span className="hidden md:block">
                      <span className={cx("block", i <= d.step ? "text-ink font-medium" : "text-faint")}>{s.title}</span>
                      <span className="block text-faint t-12">{s.sub}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="hidden md:block mt-8 h-1 rounded-full bg-hover overflow-hidden">
                <div className="h-full bg-blue rounded-full" style={{ width: `${(d.step / 4) * 100}%`, transition: "width 500ms var(--ease-morph)" }} />
              </div>
            </aside>

            <section className="min-w-0">
              <div className="morph" style={{ height: h }}>
                <div ref={body}>
                  <div key={d.step} className="step-in p-6 sm:p-8">
                    {d.step === 0 && <StepAgency d={d} set={set} />}
                    {d.step === 1 && <StepWebsite d={d} set={(p) => { set(p); if (p.site !== undefined) setMeta(null); }} meta={meta} busy={busy} />}
                    {d.step === 2 && <StepEngines d={d} set={set} />}
                    {d.step === 3 && <StepClients d={d} set={set} />}
                    {d.step === 4 && <StepLaunch d={d} meta={meta} />}
                    {d.step < 4 && (
                      <>
                        <p role="alert" className="field-error mt-4">{error}</p>
                        <div className="flex items-center justify-between mt-4 pt-5 hair-t">
                          <Button variant="ghost" onClick={() => { setError(null); set({ step: Math.max(0, d.step - 1) }); }} disabled={d.step === 0}>
                            <ArrowLeft size={14} /> Back
                          </Button>
                          <Button variant="primary" onClick={next} loading={busy} minWidth={150}>
                            {d.step === 1 && (!meta || meta.domain !== normaliseDomain(d.site)) ? "Find my agency" : d.step === 3 ? "Set up tracking" : "Continue"} <ArrowRight size={14} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

type StepProps = { d: Draft; set: (p: Partial<Draft>) => void };

function StepHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mb-6">
      <p className="text-faint mb-1.5">{eyebrow}</p>
      <h1 className="h2">{title}</h1>
      <p className="text-muted mt-1.5 t-14 max-w-[520px]">{body}</p>
    </div>
  );
}

function StepAgency({ d, set }: StepProps) {
  return (
    <>
      <StepHead eyebrow="Let's set up your workspace" title="How many clients do you manage?" body="We size your workspace and suggest a plan. You can change this any time." />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-8" role="radiogroup" aria-label="Number of clients">
        {CLIENT_BANDS.map((b) => (
          <button key={b.id} role="radio" aria-checked={d.band === b.id} onClick={() => set({ band: b.id })}
            className={cx("h-[68px] rounded-md border px-3 text-left transition-colors", d.band === b.id ? "border-blue-edge bg-blue-soft" : "border-hairline hover:bg-row-hover")}>
            <span className="block text-ink font-medium t-16 tnum">{b.label}</span>
            <span className="block text-faint">{b.hint}</span>
          </button>
        ))}
      </div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-ink font-medium t-14">Where are your clients?</p>
          <p className="text-faint">Pick every market. Prompts are written for each client&apos;s market.</p>
        </div>
        <span className="tag tnum">{d.regions.length} selected</span>
      </div>
      <RegionGrid value={d.regions} onChange={(regions) => set({ regions })} />
    </>
  );
}

function StepWebsite({ d, set, meta, busy }: StepProps & { meta: { domain: string; favicon_url: string } | null; busy: boolean }) {
  const domain = normaliseDomain(d.site);
  return (
    <>
      <StepHead eyebrow="Your brand" title="What's your agency's website?" body="We pull your name and logo from it so the workspace feels like yours, top left, on every screen." />
      <Field label="Website" htmlFor="site" hint="Just the domain is fine.">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2"><Favicon domain={domain} size={18} name="·" /></span>
          <input id="site" autoFocus className="input pl-9" placeholder="youragency.com" value={d.site} onChange={(e) => set({ site: e.target.value })} />
        </div>
      </Field>
      <div className="mt-6 rounded-md border border-hairline overflow-hidden">
        <div className="h-9 px-3 flex items-center gap-1.5 hair-b bg-row-hover">
          <span className="size-2 rounded-full bg-hairline" /><span className="size-2 rounded-full bg-hairline" /><span className="size-2 rounded-full bg-hairline" />
          <span className="ml-2 text-faint t-12">Preview</span>
          {busy && <span className="ml-auto"><LiveStatus label="Reading site" /></span>}
        </div>
        <div className="flex">
          <div className="w-[220px] hair-r p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2.5 h-8 px-1.5">
              {meta ? <Favicon src={meta.favicon_url} domain={meta.domain} name={d.agencyName} size={22} /> : <span className="size-[22px] rounded-[5px] skeleton" />}
              {meta ? (
                <input aria-label="Agency name" className="flex-1 min-w-0 font-medium text-ink outline-none bg-transparent border-b border-dashed border-btn-edge focus:border-blue" value={d.agencyName} onChange={(e) => set({ agencyName: e.target.value })} />
              ) : <span className="h-3 w-24 skeleton" />}
            </div>
            <div className="btn btn-primary btn-compact justify-start pointer-events-none"><Plus size={13} className="text-blue" /> Add client</div>
            <div className="h-7 rounded-md bg-blue-soft" />
            <div className="h-7 rounded-md" style={{ background: "repeating-linear-gradient(90deg,var(--hover) 0 60%,transparent 60% 100%)", opacity: 0.7 }} />
          </div>
          <div className="flex-1 p-4 grid-bg opacity-60" />
        </div>
      </div>
      {meta && <p className="text-faint mt-3">Click the name to edit it.</p>}
    </>
  );
}

function StepEngines({ d, set }: StepProps) {
  return (
    <>
      <StepHead eyebrow="Answer engines" title="Which AI assistants should we watch?" body={`Pick up to ${MAX_ENGINES}. Every prompt runs on each live engine you choose.`} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-faint">{plural(liveEngineIds(d.engines).length, "live engine")} selected</span>
        <span className="tag tnum">{d.engines.length}/{MAX_ENGINES}</span>
      </div>
      <EnginePicker value={d.engines} onChange={(engines) => set({ engines })} />
      <p className="text-faint mt-4">* We add engines as DataForSEO supports them. Ones you pick now switch on automatically, at no extra cost during your trial.</p>
    </>
  );
}

function StepClients({ d, set }: StepProps) {
  const rows = d.clients;
  const update = (i: number, v: string) => set({ clients: rows.map((r, j) => (j === i ? v : r)) });
  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const parts = e.clipboardData.getData("text").split(/[\s,;]+/).filter(Boolean);
    if (parts.length < 2) return;
    e.preventDefault();
    const next = [...rows];
    next.splice(i, 1, ...parts);
    set({ clients: next.slice(0, 50) });
  }
  return (
    <>
      <StepHead eyebrow="Your book" title="Who are your clients?" body="Add their domains. Paste a list to add many at once. For each one we read the site and write up to 10 prompts." />
      <ul className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
        {rows.map((v, i) => {
          const dom = normaliseDomain(v);
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="tnum text-faint w-5 text-right">{i + 1}</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2"><Favicon domain={dom} size={18} name="·" /></span>
                <input className="input pl-9" placeholder={["clientone.com", "anotherclient.co.uk", "thirdclient.io"][i] ?? "client.com"} value={v} onChange={(e) => update(i, e.target.value)} onPaste={(e) => onPaste(i, e)} autoFocus={i === 0}
                  aria-label={`Client ${i + 1} domain`} aria-invalid={!!v.trim() && !dom} />
              </div>
              <span className="w-[110px] truncate text-faint">{dom ? nameFromDomain(dom) : ""}</span>
              <button className="btn btn-ghost btn-icon" aria-label="Remove" onClick={() => set({ clients: rows.length > 1 ? rows.filter((_, j) => j !== i) : [""] })}><Trash size={14} /></button>
            </li>
          );
        })}
      </ul>
      <button className="chip chip-dashed mt-3" onClick={() => set({ clients: [...rows, ""] })}><Plus size={13} /> Add another</button>
    </>
  );
}

type Job = { domain: string; name: string; stage: 0 | 1 | 2 | 3; prompts: number; error?: string };

function StepLaunch({ d, meta }: { d: Draft; meta: { domain: string; favicon_url: string } | null }) {
  const router = useRouter();
  const st = useApp();
  const [jobs, setJobs] = useState<Job[]>(() => [...new Set(d.clients.map(normaliseDomain).filter(Boolean) as string[])].map((domain) => ({ domain, name: nameFromDomain(domain), stage: 0, prompts: 0 })));
  const [phase, setPhase] = useState<"agency" | "clients" | "done" | "error">("agency");
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const agency = st.agency ?? await st.createAgency({
          name: d.agencyName.trim(), website: meta ? `https://${meta.domain}` : null, domain: meta?.domain ?? null, favicon_url: meta?.favicon_url ?? null,
          client_count_band: d.band, regions: d.regions, engines: d.engines.slice(0, MAX_ENGINES),
        });
        setPhase("clients");
        const region = d.regions.find((r) => r !== "GLOBAL") ?? "GB";
        const inputs: NewClientInput[] = [];
        // Up to 3 sites at a time.
        const queue = [...jobs];
        const worker = async () => {
          while (queue.length) {
            const j = queue.shift()!;
            const patch = (p: Partial<Job>) => setJobs((all) => all.map((x) => (x.domain === j.domain ? { ...x, ...p } : x)));
            patch({ stage: 1 });
            let name = j.name, favicon = faviconFor(j.domain, 128), description: string | null = null;
            try { const m = await repo.siteMeta(j.domain); name = m.name; favicon = m.favicon_url; description = m.description; } catch { /* keep defaults */ }
            patch({ stage: 2, name });
            let prompts: NewClientInput["prompts"] = [];
            try {
              const g = await repo.generatePrompts(agency.id, { name, domain: j.domain, description, region, competitors: [] }, 10);
              prompts = g.prompts.map((p) => ({ ...p, source: g.source }));
            } catch { /* client still gets added, prompts can be written later */ }
            inputs.push({ name, domain: j.domain, favicon_url: favicon, description, industry: null, region, competitors: [], prompts });
            patch({ stage: 3, prompts: prompts.length });
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        await st.addClients(inputs);
        await st.updateAgency({ onboarded_at: new Date().toISOString() });
        sessionStorage.removeItem(DRAFT_KEY);
        await useApp.getState().refresh();
        setPhase("done");
      } catch (e) {
        setErr((e as Error).message);
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "done" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#5f86e0", "#c4d4f5", "#27a644", "#d18b0f", "#eb5757", "#08090a"];
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors, scalar: 0.9, ticks: 220 });
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors }), 220);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors }), 380);
  }, [phase]);

  const total = jobs.length * 3 + 1;
  const progress = (phase === "agency" ? 0 : 1) + jobs.reduce((s, j) => s + j.stage, 0);
  const engines = liveEngineIds(d.engines);
  const promptCount = jobs.reduce((s, j) => s + j.prompts, 0);

  if (phase === "error") {
    return (
      <div>
        <StepHead eyebrow="Something went wrong" title="We couldn't finish setup" body={`${err} Your answers are saved. Try again.`} />
        <Button variant="primary" onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      {phase === "done" ? (
        <StepHead eyebrow="You're live" title={`${d.agencyName} is ready`} body={`${plural(jobs.length, "client")}, ${plural(promptCount, "prompt")} and ${plural(engines.length, "engine")}. Sample history is loaded so you can explore while the first live checks run.`} />
      ) : (
        <StepHead eyebrow="Setting up" title="Building your workspace" body="Reading each client's website and asking Claude Haiku to write the prompts their buyers type into AI." />
      )}

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-hover overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemax={total}>
          <div className="h-full rounded-full bg-blue" style={{ width: `${(progress / total) * 100}%`, transition: "width 500ms var(--ease-morph)" }} />
        </div>
        <span className="tnum text-faint w-10 text-right">{Math.round((progress / total) * 100)}%</span>
      </div>

      <ul className="flex flex-col max-h-[260px] overflow-y-auto mb-2">
        {jobs.map((j) => (
          <li key={j.domain} className="h-11 flex items-center gap-3 hair-b border-divider last:border-b-0">
            <Favicon domain={j.domain} name={j.name} size={20} />
            <span className="min-w-0 flex-1">
              <span className="block text-ink truncate">{j.name}</span>
            </span>
            <span className="w-[200px] flex items-center justify-end gap-2 text-faint">
              {j.stage === 0 && "Waiting"}
              {j.stage === 1 && <LiveStatus label="Reading site" />}
              {j.stage === 2 && <LiveStatus label="Writing prompts" />}
              {j.stage === 3 && <><span className="tnum">{plural(j.prompts, "prompt")}</span><span className="size-4 rounded-full bg-blue grid place-items-center"><Check size={9} weight="bold" color="#fff" /></span></>}
            </span>
          </li>
        ))}
      </ul>

      {phase === "done" && (
        <div className="step-in">
          <div className="flex items-center gap-2 mt-5 mb-3">
            <p className="text-ink font-medium">Next steps</p>
            <span className="flex gap-1 ml-auto">{engines.map((e) => <EngineLogo key={e} id={e} size={14} />)}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { Icon: Compass, t: "Take the 60-second tour", b: "We'll point out each part of the dashboard." },
              { Icon: ChartLineUp, t: "Read your book at a glance", b: "Visibility, mentions and citations for every client." },
              { Icon: Flask, t: "Run one live check", b: "Test a single prompt on a single engine in the API lab." },
              { Icon: UsersThree, t: "Invite your team", b: "Seats live in Settings. Trial includes 3." },
            ].map(({ Icon, t, b }) => (
              <div key={t} className="p-3 rounded-md border border-hairline flex gap-3">
                <Icon size={18} weight="duotone" color="var(--blue)" className="flex-none mt-0.5" />
                <span><span className="block text-ink font-medium">{t}</span><span className="block text-faint">{b}</span></span>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6 pt-5 hair-t">
            <Button variant="primary" size="large" onClick={() => router.replace("/dashboard")}>
              <Sparkle size={15} weight="duotone" className="text-blue" /> Go to dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

