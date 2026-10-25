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
  reset(): void;
};

let unwatch: (() => void) | null = null;
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
    await repo.retryStrategy(get().agencyId!, auditId);
    await get().loadAudit(auditId);
  },
  async updateLead(id, patch) {
    const prev = get().leads;
    set({ leads: prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
    try { await repo.updateLead(id, patch); } catch (e) { set({ leads: prev }); throw e; }
  },
  reset() {
    unwatch?.();
    unwatch = null;
    set({ agencyId: null, loaded: false, widget: null, credits: null, audits: [], leads: [], full: {} });
  },
}));
