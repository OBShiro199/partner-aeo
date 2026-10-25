"use client";
import { create } from "zustand";
import { repo } from "./repo";
import { useGrowth } from "./growth";
import type { NewAgencyInput } from "./repo/types";
import type { Agency, Client, Competitor, DfsStatus, Intent, Invite, Member, NewClientInput, Prompt, Result, Role, User } from "./types";

type Toast = { id: number; text: string; tone?: "default" | "error"; action?: { label: string; href: string } };

type State = {
  status: "idle" | "loading" | "anon" | "no-agency" | "ready" | "error";
  error: string | null;
  user: User | null;
  agency: Agency | null;
  role: Role;
  members: Member[];
  invites: Invite[];
  clients: Client[];
  competitors: Competitor[];
  prompts: Prompt[];
  results: Result[];
  dfs: DfsStatus | null;

  // UI state that survives navigation
  filterClient: string | null;        // null = all clients
  rangeDays: 7 | 30 | 90;
  engineFilter: string[];             // empty = all
  addClientOpen: boolean;
  checking: Record<string, boolean>;  // `${promptId}|${engine}`
  toasts: Toast[];

  boot(): Promise<void>;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
  createAgency(input: NewAgencyInput): Promise<Agency>;
  updateAgency(patch: Partial<Agency>): Promise<void>;
  addClients(inputs: NewClientInput[]): Promise<Client[]>;
  updateClient(id: string, patch: Partial<Client>): Promise<void>;
  deleteClient(id: string): Promise<void>;
  setCompetitors(clientId: string, list: { name: string; domain: string | null }[]): Promise<void>;
  addPrompt(clientId: string, text: string, intent: Intent): Promise<void>;
  updatePrompt(id: string, patch: Partial<Prompt>): Promise<void>;
  deletePrompt(id: string): Promise<void>;
  runCheck(args: { promptId?: string; clientId: string; promptText?: string; engine: string }): Promise<Result | null>;
  loadDfs(): Promise<void>;
  invite(email: string, role: Role): Promise<void>;
  revokeInvite(id: string): Promise<void>;
  removeMember(userId: string): Promise<void>;

  setFilterClient(id: string | null): void;
  setRange(d: 7 | 30 | 90): void;
  toggleEngine(id: string): void;
  setAddClientOpen(v: boolean): void;
  toast(text: string, opts?: Omit<Toast, "id" | "text">): void;
  dismissToast(id: number): void;
};

let toastId = 0;
let booted: Promise<void> | null = null;

export const useApp = create<State>((set, get) => ({
  status: "idle",
  error: null,
  user: null,
  agency: null,
  role: "member",
  members: [],
  invites: [],
  clients: [],
  competitors: [],
  prompts: [],
  results: [],
  dfs: null,
  filterClient: null,
  rangeDays: 30,
  engineFilter: [],
  addClientOpen: false,
  checking: {},
  toasts: [],

  boot() {
    if (!booted) {
      booted = (async () => {
        set({ status: "loading" });
        repo.onAuthChange((u) => {
          if (!u) set({ status: "anon", user: null, agency: null, clients: [], results: [] });
        });
        await get().refresh();
      })();
    }
    return booted;
  },

  async refresh() {
    try {
      const user = await repo.currentUser();
      if (!user) return set({ status: "anon", user: null });
      const ws = await repo.loadWorkspace();
      if (!ws) return set({ status: "no-agency", user });
      set({ status: "ready", user, error: null, ...ws });
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  async signOut() {
    await repo.signOut();
    booted = null;
    useGrowth.getState().reset();
    set({ status: "anon", user: null, agency: null, clients: [], prompts: [], results: [], competitors: [], filterClient: null });
  },

  async createAgency(input) {
    const agency = await repo.createAgency(input);
    set({ agency, role: "owner" });
    return agency;
  },
  async updateAgency(patch) {
    const a = get().agency!;
    set({ agency: { ...a, ...patch } });
    try {
      set({ agency: await repo.updateAgency(a.id, patch) });
    } catch (e) {
      set({ agency: a });
      throw e;
    }
  },

  async addClients(inputs) {
    const a = get().agency!;
    const out = await repo.addClients(a.id, inputs);
    set((s) => ({
      clients: [...s.clients, ...out.clients],
      competitors: [...s.competitors, ...out.competitors],
      prompts: [...s.prompts, ...out.prompts],
      results: [...out.results, ...s.results],
    }));
    return out.clients;
  },
  async updateClient(id, patch) {
    const prev = get().clients;
    set({ clients: prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    try { await repo.updateClient(id, patch); } catch (e) { set({ clients: prev }); throw e; }
  },
  async deleteClient(id) {
    await repo.deleteClient(id);
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      prompts: s.prompts.filter((p) => p.client_id !== id),
      results: s.results.filter((r) => r.client_id !== id),
      competitors: s.competitors.filter((c) => c.client_id !== id),
      filterClient: s.filterClient === id ? null : s.filterClient,
    }));
  },

  async setCompetitors(clientId, list) {
    const rows = await repo.setCompetitors(get().agency!.id, clientId, list);
    set((s) => ({ competitors: s.competitors.filter((c) => c.client_id !== clientId).concat(rows) }));
  },

  async addPrompt(clientId, text, intent) {
    const p = await repo.addPrompt(get().agency!.id, clientId, text, intent);
    set((s) => ({ prompts: [...s.prompts, p] }));
  },
  async updatePrompt(id, patch) {
    const prev = get().prompts;
    set({ prompts: prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    try { await repo.updatePrompt(id, patch); } catch (e) { set({ prompts: prev }); throw e; }
  },
  async deletePrompt(id) {
    const prev = get().prompts;
    set({ prompts: prev.filter((p) => p.id !== id) });
    try { await repo.deletePrompt(id); } catch (e) { set({ prompts: prev }); throw e; }
  },

  async runCheck(args) {
    const key = `${args.promptId ?? args.promptText}|${args.engine}`;
    set((s) => ({ checking: { ...s.checking, [key]: true } }));
    try {
      const { result, usage } = await repo.runCheck(get().agency!.id, args);
      set((s) => ({
        results: [result, ...s.results],
        dfs: s.dfs ? { ...s.dfs, calls_used: usage.calls_used, spent_usd: usage.spent_usd } : s.dfs,
      }));
      return result;
    } catch (e) {
      get().toast((e as Error).message, { tone: "error" });
      return null;
    } finally {
      set((s) => {
        const c = { ...s.checking };
        delete c[key];
        return { checking: c };
      });
    }
  },
  async loadDfs() {
    try { set({ dfs: await repo.dfsStatus(get().agency!.id) }); } catch { /* panel shows unknown */ }
  },

  async invite(email, role) {
    const inv = await repo.invite(get().agency!.id, email, role);
    set((s) => ({ invites: [...s.invites, inv] }));
    repo.flushEmail();
  },
  async revokeInvite(id) {
    await repo.revokeInvite(id);
    set((s) => ({ invites: s.invites.filter((i) => i.id !== id) }));
  },
  async removeMember(userId) {
    await repo.removeMember(get().agency!.id, userId);
    set((s) => ({ members: s.members.filter((m) => m.user_id !== userId) }));
  },

  setFilterClient: (id) => set({ filterClient: id }),
  setRange: (d) => set({ rangeDays: d }),
  toggleEngine: (id) => set((s) => ({ engineFilter: s.engineFilter.includes(id) ? s.engineFilter.filter((x) => x !== id) : [...s.engineFilter, id] })),
  setAddClientOpen: (v) => set({ addClientOpen: v }),
  toast(text, opts) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, ...opts }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
