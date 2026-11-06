"use client";
// Widget, audits and leads for the current agency. Loaded once, then kept live over Realtime.
import { create } from "zustand";
import { repo } from "./repo";
import type { StrategyInput } from "./repo/types";
import type { Audit, Credits, Lead, Widget } from "./types";

type Growth = {
  agencyId: string | null;
  loaded: boolean;
  widget: Widget | null;
  credits: Credits | null;
  audits: Audit[];
  leads: Lead[];
  full: Record<string, Audit>;     // audits with report/hub/assets, by id
  load(agencyId: string): Promise<void>;
  loadAudit(id: string): Promise<Audit | null>;
  refreshCredits(): Promise<void>;
  saveWidget(patch: Partial<Widget>): Promise<void>;
  runStrategy(input: StrategyInput): Promise<string>;
  retry(auditId: string): Promise<void>;
  updateLead(id: string, patch: Partial<Pick<Lead, "status" | "notes">>): Promise<void>;
  startSprint(input: { client_url: string; niche: string; location: string; region: string }): Promise<void>;
  selfAudit(): Promise<string>;
  runSprintQueue(): void;
  reset(): void;
};

let unwatch: (() => void) | null = null;
let sprintRunning = false;
const inFlight = new Set<string>();
// The list keeps the small columns (tech, business) and drops the large ones.
const strip = (a: Audit): Audit => ({ ...a, report: {}, hub: {}, assets: {} });

export const useGrowth = create<Growth>((set, get) => ({
  agencyId: null,
  loaded: false,
  widget: null,
  credits: null,
  audits: [],
  leads: [],
  full: {},

  async load(agencyId) {
    if (get().agencyId === agencyId && get().loaded) return;
    set({ agencyId });
    const [widget, credits, audits, leads] = await Promise.all([
      repo.widget(agencyId), repo.credits(agencyId).catch(() => null), repo.audits(agencyId), repo.leads(agencyId),
    ]);
    set({ widget, credits, audits, leads, loaded: true });
    unwatch?.();
    unwatch = repo.watchGrowth(agencyId, (e) => {
      if (e.table === "leads") {
        set((s) => ({ leads: s.leads.some((l) => l.id === e.row.id) ? s.leads.map((l) => (l.id === e.row.id ? e.row : l)) : [e.row, ...s.leads] }));
        return;
      }
      const row = e.row;
      set((s) => ({
        audits: s.audits.some((a) => a.id === row.id) ? s.audits.map((a) => (a.id === row.id ? strip(row) : a)) : [strip(row), ...s.audits],
        // Realtime rows can be truncated for large JSON, so refetch the full row when it matters.
        full: s.full[row.id] ? { ...s.full, [row.id]: { ...s.full[row.id], status: row.status, stage: row.stage } } : s.full,
      }));
      if (get().full[row.id] && (row.status === "complete" || row.status === "failed")) get().loadAudit(row.id);
    });
  },

  async loadAudit(id) {
    const a = await repo.audit(id);
    if (a) set((s) => ({ full: { ...s.full, [id]: a }, audits: s.audits.map((x) => (x.id === id ? strip(a) : x)) }));
    return a;
  },
  async refreshCredits() {
    const id = get().agencyId;
    if (id) set({ credits: await repo.credits(id) });
  },
  async saveWidget(patch) {
    set({ widget: await repo.saveWidget(get().agencyId!, patch) });
  },
  async runStrategy(input) {
    const { audit_id } = await repo.runStrategy(get().agencyId!, input);
    await Promise.all([get().loadAudit(audit_id), get().refreshCredits()]);
    return audit_id;
  },
  async retry(auditId) {
    // A sprint audit that didn't finish re-runs its quick check; anything else builds the full pack.
    const a = get().audits.find((x) => x.id === auditId);
    if (a?.source === "sprint" && a.status !== "complete") await repo.runLite(get().agencyId!, auditId);
    else await repo.retryStrategy(get().agencyId!, auditId);
    await get().loadAudit(auditId);
  },
  async updateLead(id, patch) {
    const prev = get().leads;
    set({ leads: prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
    try { await repo.updateLead(id, patch); } catch (e) { set({ leads: prev }); throw e; }
  },
  async startSprint(input) {
    await repo.startSprint(get().agencyId!, input);
    set({ audits: await repo.audits(get().agencyId!) });
    get().runSprintQueue();
  },
  async selfAudit() {
    const id = await repo.selfAudit(get().agencyId!);
    set({ audits: await repo.audits(get().agencyId!) });
    get().runSprintQueue();
    return id;
  },
  // Sprint audits are created queued; their AI checks run here, two at a time (each makes ~8 engine
  // calls and DataForSEO allows 30 at once). Survives navigation; resumes on the next load if the tab closed.
  runSprintQueue() {
    if (sprintRunning) return;
    sprintRunning = true;
    const agencyId = get().agencyId!;
    const waitFor = async (id: string) => {
      for (let t = 0; t < 120; t++) {
        await new Promise((r) => setTimeout(r, 2500));
        const a = (await repo.audits(agencyId)).find((x) => x.id === id);
        if (!a || a.status === "complete" || a.status === "failed") { set({ audits: await repo.audits(agencyId) }); return; }
      }
    };
    const next = () => get().audits.find((a) => a.source === "sprint" && a.status === "queued" && !inFlight.has(a.id));
    const worker = async () => {
      for (let a = next(); a; a = next()) {
        inFlight.add(a.id);
        try { await repo.runLite(agencyId, a.id); await waitFor(a.id); }
        catch { set({ audits: await repo.audits(agencyId) }); }
      }
    };
    Promise.all([worker(), worker()]).finally(() => { sprintRunning = false; });
  },
  reset() {
    unwatch?.();
    unwatch = null;
    set({ agencyId: null, loaded: false, widget: null, credits: null, audits: [], leads: [], full: {} });
  },
}));
