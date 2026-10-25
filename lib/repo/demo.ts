// Browser-only repo used when NEXT_PUBLIC_DEMO_MODE=1 or Supabase isn't configured.
// Persists to localStorage and generates clearly-labelled sample answers so every screen can be explored for free.
import type { Agency, Client, Competitor, Intent, Invite, Member, Prompt, Result, Role, UsageRow, User } from "../types";
import type { EmailPrefs, GeneratedPrompts, Repo } from "./types";
import { analyse } from "../../supabase/functions/_shared/analyse";
import { faviconFor, nameFromDomain, normaliseDomain } from "../format";
import { engineById, liveEngineIds } from "../engines";
import { regionByCode } from "../regions";

const KEY = "partner-aeo-demo-v1";
const DAY = 86_400_000;

type Db = {
  users: (User & { password: string })[];
  session: string | null;
  agencies: Agency[];
  members: (Member & { agency_id: string })[];
  invites: (Invite & { agency_id: string })[];
  clients: Client[];
  competitors: Competitor[];
  prompts: Prompt[];
  results: Result[];
  usage: (UsageRow & { agency_id: string })[];
  emailPrefs?: EmailPrefs;
};

const empty = (): Db => ({ users: [], session: null, agencies: [], members: [], invites: [], clients: [], competitors: [], prompts: [], results: [], usage: [] });

function load(): Db {
  if (typeof window === "undefined") return empty();
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty();
  }
}
function save(d: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Quota: drop the oldest sample answers and retry once.
    d.results = d.results.slice(-1500);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* give up quietly */ }
  }
}

const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const listeners = new Set<(u: User | null) => void>();

// Deterministic pseudo-random so sample data is stable across reloads.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const SOURCES = ["g2.com", "reddit.com", "trustpilot.com", "capterra.com", "forbes.com", "techradar.com", "wikipedia.org", "youtube.com", "linkedin.com", "yell.com", "clutch.co", "medium.com"];
const FILLER = ["Northwind", "Brightline", "Kestrel & Co", "Fernhill", "Halden", "Lumen", "Arbor", "Copperleaf", "Westmark", "Bluebell"];

function sampleAnswer(client: Client, comps: Competitor[], prompt: string, engine: string, strength: number, seed: string) {
  const r = (k: string) => hash(seed + k);
  const others = [...comps.map((c) => c.name), ...FILLER].sort((a, b) => r(a) - r(b)).slice(0, 5);
  const mentioned = r("m") < strength;
  const list = [...others];
  let position: number | null = null;
  if (mentioned) {
    position = Math.min(list.length, Math.floor(r("p") * (strength > 0.6 ? 2.5 : 5)));
    list.splice(position, 0, client.name);
  }
  const lines = list.slice(0, 5).map((n, i) => `${i + 1}. **${n}**: ${["Strong reviews and fast onboarding.", "Popular with small teams, simple pricing.", "Good integrations and responsive support.", "Well known in the area, solid track record.", "Flexible plans and a free trial."][i]}`);
  const text = `Here are some options people often recommend for "${prompt}":\n\n${lines.join("\n")}\n\nCompare pricing, read recent reviews and check what's included before you decide.`;
  const cites = SOURCES.filter((s) => r("c" + s) < 0.35).slice(0, 5).map((d) => ({ url: `https://${d}/`, domain: d }));
  if (mentioned && r("own") < 0.55) cites.unshift({ url: `https://${client.domain}/`, domain: client.domain });
  const a = analyse(text, cites, { name: client.name, domain: client.domain }, comps);
  return { text, citations: cites, ...a, model: engineById(engine)?.name ?? engine };
}

function seedHistory(client: Client, comps: Competitor[], prompts: Prompt[], engines: string[], weeks = 8): Result[] {
  const base = 0.25 + hash(client.domain) * 0.5;
  const out: Result[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const scan = id();
    const t = Date.now() - w * 7 * DAY - hash(client.id + w) * DAY;
    for (const p of prompts) {
      for (const e of engines) {
        const bias = { chatgpt: 0.05, gemini: -0.05, claude: 0, perplexity: 0.1 }[e] ?? 0;
        const strength = Math.max(0.05, Math.min(0.95, base + bias + (weeks - w) * 0.018 + (hash(p.id) - 0.5) * 0.3));
        const s = sampleAnswer(client, comps, p.text, e, strength, `${p.id}${e}${w}`);
        out.push({
          id: id(), scan_id: scan, client_id: client.id, prompt_id: p.id, prompt_text: p.text, engine: e, model: s.model,
          status: "done", response_text: s.text, citations: s.citations, mentioned: s.mentioned, position: s.position,
          competitors_mentioned: s.competitors_mentioned, own_domain_cited: s.own_domain_cited, cost_usd: 0, latency_ms: 1200 + Math.round(hash(p.id + e) * 4000),
          error: null, created_at: new Date(t).toISOString(),
        });
      }
    }
  }
  return out;
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/crm|sales/, "CRM software"], [/dental|dentist|smile/, "dentist"], [/law|legal|solicitor/, "law firm"],
  [/plumb|heat|boiler/, "plumber"], [/account|tax|bookkeep/, "accountant"], [/estate|property|homes/, "estate agent"],
  [/hr|people|payroll/, "HR software"], [/shop|store|wear|fashion/, "online store"], [/clinic|health|care|physio/, "clinic"],
  [/agency|studio|media|digital/, "marketing agency"], [/ai|bot|voice|recept/, "AI receptionist"], [/fit|gym/, "gym"],
  [/hotel|stay|inn/, "hotel"], [/coffee|cafe|food|kitchen/, "restaurant"], [/insur/, "insurance provider"],
];

export function templatePrompts(name: string, domain: string, region: string, competitors: string[], description?: string | null, count = 10) {
  const hay = `${domain} ${description ?? ""}`.toLowerCase();
  const category = CATEGORY_HINTS.find(([re]) => re.test(hay))?.[1] ?? "provider";
  const where = regionByCode(region)?.group === "Global" ? "" : ` in ${regionByCode(region)?.name ?? region}`;
  const out: { text: string; intent: Intent }[] = [
    { text: `What is the best ${category}${where}?`, intent: "best_for" },
    { text: `Best ${category} for small businesses`, intent: "best_for" },
    { text: `Which ${category} do people recommend${where}?`, intent: "local" },
    { text: `How do I choose a good ${category}?`, intent: "problem" },
    { text: `Affordable ${category} with great reviews`, intent: "problem" },
    { text: `Top rated ${category} companies${where} this year`, intent: "local" },
    ...competitors.slice(0, 3).map((c) => ({ text: `Best alternatives to ${c}`, intent: "comparison" as Intent })),
    { text: `What should I look for in a ${category}?`, intent: "problem" },
    { text: `Most trusted ${category} for growing teams`, intent: "best_for" },
  ];
  return { category, prompts: out.slice(0, count).filter((p) => !p.text.toLowerCase().includes(name.toLowerCase())) };
}

function me(d: Db) {
  const u = d.users.find((x) => x.id === d.session);
  if (!u) throw new Error("Sign in to continue.");
  return u;
}

export const demoRepo: Repo = {
  mode: "demo",

  async currentUser() {
    const d = load();
    const u = d.users.find((x) => x.id === d.session);
    return u ? { id: u.id, email: u.email, full_name: u.full_name } : null;
  },
  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async signUp(email, password, fullName) {
    await wait(500);
    const d = load();
    if (d.users.some((u) => u.email === email.toLowerCase())) throw new Error("An account with that email already exists. Log in instead.");
    const u = { id: id(), email: email.toLowerCase(), full_name: fullName, password };
    d.users.push(u);
    d.session = u.id;
    save(d);
    listeners.forEach((l) => l(u));
    return { needsConfirmation: false };
  },
  async signIn(email, password) {
    await wait(400);
    const d = load();
    const u = d.users.find((x) => x.email === email.toLowerCase() && x.password === password);
    if (!u) throw new Error("That email and password don't match.");
    d.session = u.id;
    save(d);
    listeners.forEach((l) => l(u));
  },
  async sendPasswordReset() {
    await wait(500); // Demo: no email is sent.
  },
  async updatePassword(password) {
    const d = load();
    const u = me(d);
    u.password = password;
    save(d);
  },
  async emailPrefs() {
    return load().emailPrefs ?? { weekly_digest: true, alerts: true, product: true };
  },
  async setEmailPrefs(patch) {
    const d = load();
    d.emailPrefs = { ...(d.emailPrefs ?? { weekly_digest: true, alerts: true, product: true }), ...patch };
    save(d);
    return d.emailPrefs;
  },
  flushEmail() {},

  async signOut() {
    const d = load();
    d.session = null;
    save(d);
    listeners.forEach((l) => l(null));
  },

  async loadWorkspace() {
    const d = load();
    if (!d.session) return null;
    const m = d.members.find((x) => x.user_id === d.session);
    if (!m) return null;
    const a = d.agencies.find((x) => x.id === m.agency_id)!;
    return {
      agency: a,
      role: m.role,
      members: d.members.filter((x) => x.agency_id === a.id),
      invites: d.invites.filter((x) => x.agency_id === a.id),
      clients: d.clients.filter((x) => x.agency_id === a.id),
      competitors: d.competitors.filter((x) => d.clients.some((c) => c.id === x.client_id && c.agency_id === a.id)),
      prompts: d.prompts.filter((x) => d.clients.some((c) => c.id === x.client_id && c.agency_id === a.id)),
      results: d.results.filter((x) => d.clients.some((c) => c.id === x.client_id && c.agency_id === a.id)),
    };
  },
  async createAgency(input) {
    await wait(300);
    const d = load();
    const u = me(d);
    const a: Agency = {
      id: id(), ...input, plan: "trial", seat_limit: 3, client_limit: 25, monthly_budget_usd: 5,
      onboarded_at: null, tour_completed_at: null, created_at: now(),
    };
    d.agencies.push(a);
    d.members.push({ agency_id: a.id, user_id: u.id, role: "owner", email: u.email, full_name: u.full_name ?? "", created_at: now() });
    save(d);
    return a;
  },
  async updateAgency(aid, patch) {
    const d = load();
    const a = d.agencies.find((x) => x.id === aid)!;
    Object.assign(a, patch);
    save(d);
    return a;
  },

  async siteMeta(url) {
    await wait(650);
    const domain = normaliseDomain(url);
    if (!domain) throw new Error("Enter a domain like acme.com.");
    return { domain, name: nameFromDomain(domain), description: null, favicon_url: faviconFor(domain, 128), reachable: true };
  },
  async generatePrompts(_agencyId, client, count = 10): Promise<GeneratedPrompts> {
    await wait(1400);
    const t = templatePrompts(client.name, client.domain, client.region, client.competitors, client.description, count);
    return { prompts: t.prompts, source: "template", category: t.category };
  },

  async addClients(agencyId, inputs) {
    await wait(400);
    const d = load();
    const a = d.agencies.find((x) => x.id === agencyId)!;
    const engines = liveEngineIds(a.engines);
    const out = { clients: [] as Client[], competitors: [] as Competitor[], prompts: [] as Prompt[], results: [] as Result[] };
    for (const i of inputs) {
      if (d.clients.some((c) => c.agency_id === agencyId && c.domain === i.domain)) continue;
      const c: Client = {
        id: id(), agency_id: agencyId, name: i.name, domain: i.domain, website: `https://${i.domain}`, favicon_url: i.favicon_url,
        description: i.description, industry: i.industry, region: i.region, aliases: [], status: "active", created_at: now(),
      };
      const comps = i.competitors.map((x) => ({ id: id(), client_id: c.id, name: x.name, domain: x.domain }));
      const ps = i.prompts.slice(0, 10).map((p, n) => ({ id: id(), client_id: c.id, text: p.text, intent: p.intent, source: p.source, active: true, position: n, created_at: now() }));
      const rs = seedHistory(c, comps, ps, engines);
      d.clients.push(c); d.competitors.push(...comps); d.prompts.push(...ps); d.results.push(...rs);
      out.clients.push(c); out.competitors.push(...comps); out.prompts.push(...ps); out.results.push(...rs);
    }
    save(d);
    return out;
  },
  async updateClient(cid, patch) {
    const d = load();
    const c = d.clients.find((x) => x.id === cid)!;
    Object.assign(c, patch);
    save(d);
    return c;
  },
  async deleteClient(cid) {
    const d = load();
    d.clients = d.clients.filter((x) => x.id !== cid);
    d.prompts = d.prompts.filter((x) => x.client_id !== cid);
    d.competitors = d.competitors.filter((x) => x.client_id !== cid);
    d.results = d.results.filter((x) => x.client_id !== cid);
    save(d);
  },

  async setCompetitors(_a, clientId, list) {
    const d = load();
    const rows = list.map((c) => ({ id: id(), client_id: clientId, ...c }));
    d.competitors = d.competitors.filter((x) => x.client_id !== clientId).concat(rows);
    save(d);
    return rows;
  },

  async addPrompt(_a, clientId, text, intent) {
    const d = load();
    if (d.prompts.filter((p) => p.client_id === clientId && p.active).length >= 10) throw new Error("Each client tracks up to 10 prompts. Pause one to add another.");
    const p: Prompt = { id: id(), client_id: clientId, text, intent, source: "manual", active: true, position: 99, created_at: now() };
    d.prompts.push(p);
    save(d);
    return p;
  },
  async updatePrompt(pid, patch) {
    const d = load();
    const p = d.prompts.find((x) => x.id === pid)!;
    if (patch.active && !p.active && d.prompts.filter((x) => x.client_id === p.client_id && x.active).length >= 10) {
      throw new Error("Each client tracks up to 10 prompts. Pause one first.");
    }
    Object.assign(p, patch);
    save(d);
    return p;
  },
  async deletePrompt(pid) {
    const d = load();
    d.prompts = d.prompts.filter((x) => x.id !== pid);
    save(d);
  },

  async runCheck(agencyId, args) {
    await wait(2200 + Math.random() * 1500);
    const d = load();
    const c = d.clients.find((x) => x.id === args.clientId)!;
    const p = args.promptId ? d.prompts.find((x) => x.id === args.promptId) : null;
    const text = p?.text ?? args.promptText ?? "";
    const comps = d.competitors.filter((x) => x.client_id === c.id);
    const s = sampleAnswer(c, comps, text, args.engine, 0.3 + hash(c.domain) * 0.5, text + args.engine + Date.now());
    const r: Result = {
      id: id(), scan_id: id(), client_id: c.id, prompt_id: p?.id ?? null, prompt_text: text, engine: args.engine, model: s.model,
      status: "done", response_text: s.text, citations: s.citations, mentioned: s.mentioned, position: s.position,
      competitors_mentioned: s.competitors_mentioned, own_domain_cited: s.own_domain_cited, cost_usd: 0, latency_ms: 2400, error: null, created_at: now(),
    };
    d.results.push(r);
    d.usage.push({ agency_id: agencyId, provider: "dataforseo", endpoint: `${args.engine}/llm_responses/live (sample)`, status: "ok", cost_usd: 0, created_at: now() });
    save(d);
    return { result: r, usage: { calls_used: 0, calls_max: 3, spent_usd: 0 } };
  },
  async dfsStatus() {
    return { configured: false, balance_usd: null, calls_used: 0, calls_max: 3, spent_usd: 0, max_spend_usd: 0.3 };
  },
  async usage(agencyId) {
    return load().usage.filter((u) => u.agency_id === agencyId).reverse();
  },

  async invite(agencyId, email, role: Role) {
    const d = load();
    const a = d.agencies.find((x) => x.id === agencyId)!;
    const used = d.members.filter((m) => m.agency_id === agencyId).length + d.invites.filter((i) => i.agency_id === agencyId).length;
    if (used >= a.seat_limit) throw new Error(`All ${a.seat_limit} seats are in use. Upgrade your plan to add more.`);
    if (d.invites.some((i) => i.agency_id === agencyId && i.email === email.toLowerCase())) throw new Error("That person already has an invite.");
    const inv = { id: id(), agency_id: agencyId, email: email.toLowerCase(), role, created_at: now() };
    d.invites.push(inv);
    save(d);
    return inv;
  },
  async revokeInvite(iid) {
    const d = load();
    d.invites = d.invites.filter((x) => x.id !== iid);
    save(d);
  },
  async removeMember(agencyId, userId) {
    const d = load();
    d.members = d.members.filter((m) => !(m.agency_id === agencyId && m.user_id === userId));
    save(d);
  },

  // Growth tools call paid APIs from edge functions, so demo mode shows them empty.
  async widget() { return null; },
  async saveWidget() { throw new Error(NEEDS_SUPABASE); },
  async credits() { return null; },
  async audits() { return []; },
  async audit() { return null; },
  async runStrategy() { throw new Error(NEEDS_SUPABASE); },
  async retryStrategy() { throw new Error(NEEDS_SUPABASE); },
  async deleteAudit() {},
  async leads() { return []; },
  async updateLead() {},
  watchGrowth() { return () => {}; },
};

const NEEDS_SUPABASE = "The widget and Strategy Engine need the live backend. Turn off demo mode to use them.";
