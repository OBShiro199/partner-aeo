"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Sparkle, Trash, X as XIcon } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { repo } from "@/lib/repo";
import { faviconFor, INTENT_LABEL, INTENT_TAG, nameFromDomain, normaliseDomain, plural } from "@/lib/format";
import { liveEngineIds, EngineLogo } from "@/lib/engines";
import type { Intent } from "@/lib/types";
import { Button, cx, Dialog, DialogClose, Favicon, Field, LiveStatus } from "./ui";
import { RegionSelect } from "./pickers";

type Draft = { text: string; intent: Intent; on: boolean; source: "haiku" | "template" | "manual" };

const STEPS = ["Website", "Details", "Prompts", "Done"];

export function AddClientDialog() {
  const open = useApp((s) => s.addClientOpen);
  const setOpen = useApp((s) => s.setAddClientOpen);
  return open ? <Flow onClose={() => setOpen(false)} /> : null;
}

function Flow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const agency = useApp((s) => s.agency)!;
  const clients = useApp((s) => s.clients);
  const addClients = useApp((s) => s.addClients);
  const toast = useApp((s) => s.toast);
  const setFilter = useApp((s) => s.setFilterClient);

  const [step, setStep] = useState(0);
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ domain: string; name: string; favicon_url: string; description: string | null } | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState(agency.regions.find((r) => r !== "GLOBAL") ?? "GB");
  const [description, setDescription] = useState("");
  const [comps, setComps] = useState<string[]>([]);
  const [compInput, setCompInput] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [source, setSource] = useState<"haiku" | "template">("template");
  const [newPrompt, setNewPrompt] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const domain = normaliseDomain(domainInput);
  const selected = drafts.filter((d) => d.on).length;
  const engines = liveEngineIds(agency.engines);

  async function lookup() {
    if (!domain) return setError("Enter a domain like acme.com.");
    if (clients.some((c) => c.domain === domain)) return setError(`${domain} is already one of your clients.`);
    setError(null);
    setBusy(true);
    try {
      const m = await repo.siteMeta(domain);
      setMeta(m);
      setName(m.name);
      setDescription(m.description ?? "");
    } catch {
      setMeta({ domain, name: nameFromDomain(domain), favicon_url: faviconFor(domain, 128), description: null });
      setName(nameFromDomain(domain));
    } finally {
      setBusy(false);
      setStep(1);
    }
  }

  async function writePrompts() {
    if (!name.trim()) return setError("Add the client's name.");
    setError(null);
    setStep(2);
    setBusy(true);
    try {
      const g = await repo.generatePrompts(agency.id, { name: name.trim(), domain: meta!.domain, description, region, competitors: comps }, 10);
      setSource(g.source);
      setDrafts(g.prompts.map((p) => ({ ...p, on: true, source: g.source })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const [c] = await addClients([{
        name: name.trim(), domain: meta!.domain, favicon_url: meta!.favicon_url, description: description || null, industry: null, region,
        competitors: comps.map((n) => ({ name: n, domain: normaliseDomain(n) })),
        prompts: drafts.filter((d) => d.on).map((d) => ({ text: d.text, intent: d.intent, source: d.source })),
      }]);
      setCreatedId(c?.id ?? null);
      setStep(3);
      toast(`${name.trim()} added`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addComp() {
    const v = compInput.trim();
    if (v && comps.length < 5 && !comps.includes(v)) setComps([...comps, v]);
    setCompInput("");
  }

  return (
    <Dialog open onClose={onClose} width={560} labelledBy="add-client-title">
      <div className="relative">
        <DialogClose onClick={onClose} />
        {/* Step rail */}
        <div className="px-6 pt-5 pb-4 hair-b">
          <p className="text-faint mb-1">New client</p>
          <h2 id="add-client-title" className="h3">{["Which website is it?", "Confirm the details", "Choose what to track", "Tracking is live"][step]}</h2>
          <div className="flex gap-1.5 mt-4" aria-hidden>
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className="h-[3px] rounded-full bg-hover overflow-hidden">
                  <div className="h-full bg-blue rounded-full" style={{ width: i <= step ? "100%" : "0%", transition: "width 400ms var(--ease-morph)" }} />
                </div>
                <p className={cx("mt-1.5 t-12", i <= step ? "text-ink" : "text-faint")}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        <div key={step} className="step-in px-6 py-5">
          {step === 0 && (
            <form onSubmit={(e) => { e.preventDefault(); lookup(); }} className="flex flex-col gap-4">
              <Field label="Client website" error={error} hint="We read the homepage for its name, logo and what it sells." htmlFor="client-domain">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2">
                    <Favicon domain={domain} size={18} name="·" />
                  </span>
                  <input id="client-domain" autoFocus className="input pl-9" placeholder="acme.com" value={domainInput} onChange={(e) => { setDomainInput(e.target.value); setError(null); }} aria-invalid={!!error} />
                </div>
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="primary" loading={busy} minWidth={120}>Continue <ArrowRight size={14} /></Button>
              </div>
            </form>
          )}

          {step === 1 && meta && (
            <form onSubmit={(e) => { e.preventDefault(); writePrompts(); }} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md border border-hairline bg-row-hover">
                <Favicon src={meta.favicon_url} domain={meta.domain} name={name} size={36} />
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate">{name || meta.domain}</p>
                  <p className="text-faint truncate">{meta.domain}</p>
                </div>
                <span className="ml-auto"><LiveStatus label="Site read" tone="green" /></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Brand name" hint="As customers would write it." htmlFor="client-name">
                  <input id="client-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Main market" htmlFor="client-region">
                  <RegionSelect id="client-region" value={region} onChange={setRegion} options={agency.regions} />
                </Field>
              </div>
              <Field label="What they sell" hint="One line. Helps Claude Haiku write realistic prompts." htmlFor="client-desc">
                <input id="client-desc" className="input" placeholder="AI receptionist for UK trades businesses" value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Competitors" hint={`${comps.length} of 5. We check whether AI names them instead.`} htmlFor="client-comp">
                <div className="flex flex-wrap items-center gap-1.5 min-h-9 p-1 rounded-md border border-btn-edge focus-within:border-faint">
                  {comps.map((c) => (
                    <span key={c} className="tag tag-blue">
                      {c}
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => setComps(comps.filter((x) => x !== c))}><XIcon size={11} /></button>
                    </span>
                  ))}
                  <input
                    id="client-comp"
                    className="flex-1 min-w-[140px] h-7 px-2 outline-none bg-transparent text-ink placeholder:text-ghost"
                    placeholder={comps.length < 5 ? "Type a name and press Enter" : "Limit reached"}
                    value={compInput}
                    disabled={comps.length >= 5}
                    onChange={(e) => setCompInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addComp(); } }}
                    onBlur={addComp}
                  />
                </div>
              </Field>
              {error && <p role="alert" className="field-error">{error}</p>}
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button type="submit" variant="primary" minWidth={160}><Sparkle size={14} weight="duotone" className="text-blue" /> Write prompts</Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              {busy ? (
                <div className="flex flex-col gap-2" aria-busy>
                  <div className="flex items-center justify-between mb-1">
                    <LiveStatus label="Claude Haiku is reading the site and writing prompts" />
                  </div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-md border border-divider flex items-center gap-3 px-3">
                      <span className="size-4 rounded-[2px] skeleton" />
                      <span className="skeleton h-3" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-muted">
                      {source === "haiku" ? "Written by Claude Haiku from the site." : "Starter prompts from templates."} Edit any line.
                    </p>
                    <span className="tag tnum" style={{ minWidth: 64, justifyContent: "center" }}>{selected}/10</span>
                  </div>
                  <ul className="flex flex-col max-h-[330px] overflow-y-auto -mx-1 px-1">
                    {drafts.map((d, i) => (
                      <li key={i} className="group h-10 flex items-center gap-3 px-2 rounded-md hover:bg-row-hover">
                        <input
                          type="checkbox"
                          className="check"
                          checked={d.on}
                          aria-label="Track this prompt"
                          onChange={() => {
                            if (!d.on && selected >= 10) return;
                            setDrafts(drafts.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
                          }}
                        />
                        <input
                          className={cx("flex-1 min-w-0 bg-transparent outline-none truncate", d.on ? "text-ink" : "text-faint")}
                          value={d.text}
                          onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                        />
                        <span className={cx("tag", INTENT_TAG[d.intent])} style={{ width: 86, justifyContent: "center" }}>{INTENT_LABEL[d.intent]}</span>
                        <button aria-label="Remove prompt" className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger-ink transition-opacity" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>
                          <Trash size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = newPrompt.trim();
                      if (t.length < 3) return;
                      setDrafts([...drafts, { text: t, intent: "other", on: selected < 10, source: "manual" }]);
                      setNewPrompt("");
                    }}
                  >
                    <input className="input" placeholder="Add your own prompt" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} />
                    <Button type="submit"><Plus size={14} /> Add</Button>
                  </form>
                  <div className="flex items-center gap-2 text-faint">
                    Checks run on
                    {engines.map((e) => <EngineLogo key={e} id={e} size={14} />)}
                    <span>· {plural(selected * engines.length, "answer")} per scan</span>
                  </div>
                  {error && <p role="alert" className="field-error">{error}</p>}
                  <div className="flex justify-between gap-2">
                    <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                    <Button variant="primary" loading={busy} disabled={!selected} onClick={create} minWidth={180}>
                      Start tracking {selected ? `(${selected})` : ""}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <SuccessMark />
              <p className="text-ink t-14 font-medium">{name} is set up</p>
              <p className="text-muted max-w-[360px]">
                {plural(selected, "prompt")} across {plural(engines.length, "engine")}. Run a check from the client page, or wait for the weekly scan.
              </p>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => { setStep(0); setDomainInput(""); setMeta(null); setDrafts([]); setComps([]); setDescription(""); }}>Add another</Button>
                <Button variant="primary" onClick={() => { onClose(); setFilter(createdId); if (createdId) router.push(`/clients/${createdId}`); }}>
                  Open client <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function SuccessMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="scribble in" aria-hidden>
      <circle cx="28" cy="28" r="26" fill="var(--blue-soft)" stroke="var(--blue-edge)" />
      <path d="M18 29.5l6.5 6.5L38.5 21" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ ["--len" as string]: 40, ["--delay" as string]: "120ms" }} />
    </svg>
  );
}

