import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { Agency, Client, Competitor, Invite, Member, Prompt, Result, Role, User } from "../types";
import type { Repo } from "./types";

let sb: SupabaseClient | null = null;
function db() {
  if (!sb) {
    sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return sb;
}

function fail(error: { message: string } | null | undefined): asserts error is null | undefined {
  if (error) throw new Error(error.message);
}

async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      throw new Error(detail?.error ?? "That request failed. Try again in a minute.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  return data as T;
}

const toUser = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): User | null =>
  u ? { id: u.id, email: u.email ?? "", full_name: (u.user_metadata?.full_name as string) ?? "" } : null;

export const supabaseRepo: Repo = {
  mode: "supabase",

  async currentUser() {
    const { data } = await db().auth.getSession();
    return toUser(data.session?.user);
  },
  onAuthChange(cb) {
    const { data } = db().auth.onAuthStateChange((_e, s) => cb(toUser(s?.user)));
    return () => data.subscription.unsubscribe();
  },
  async signUp(email, password, fullName) {
    const { data, error } = await db().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    fail(error);
    return { needsConfirmation: !data.session };
  },
  async signIn(email, password) {
    const { error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
  },
  async signOut() {
    await db().auth.signOut();
  },

  async loadWorkspace() {
    const { data: s } = await db().auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data: profile } = await db().from("profiles").select("last_agency_id").eq("id", uid).maybeSingle();
    const { data: mems, error } = await db().from("agency_members").select("agency_id, role").eq("user_id", uid);
    fail(error);
    if (!mems?.length) return null;
    const mine = mems.find((m) => m.agency_id === profile?.last_agency_id) ?? mems[0];
    const id = mine.agency_id as string;

    const [agency, members, invites, clients, competitors, prompts, results] = await Promise.all([
      db().from("agencies").select("*").eq("id", id).single(),
      db().from("agency_members").select("user_id, role, created_at, profiles:user_id(email, full_name)").eq("agency_id", id),
      db().from("agency_invites").select("id, email, role, created_at").eq("agency_id", id).is("accepted_at", null),
      db().from("clients").select("*").eq("agency_id", id).neq("status", "archived").order("created_at"),
      db().from("competitors").select("id, client_id, name, domain").eq("agency_id", id),
      db().from("prompts").select("*").eq("agency_id", id).order("position"),
      db().from("scan_results").select("*").eq("agency_id", id).order("created_at", { ascending: false }).limit(5000),
    ]);
    fail(agency.error);
    return {
      agency: agency.data as Agency,
      role: mine.role as Role,
      members: (members.data ?? []).map((m: Record<string, unknown>) => {
        const p = (m.profiles ?? {}) as { email?: string; full_name?: string };
        return { user_id: m.user_id as string, role: m.role as Role, created_at: m.created_at as string, email: p.email ?? "", full_name: p.full_name ?? "" } satisfies Member;
      }),
      invites: (invites.data ?? []) as Invite[],
      clients: (clients.data ?? []) as Client[],
      competitors: (competitors.data ?? []) as Competitor[],
      prompts: (prompts.data ?? []) as Prompt[],
      results: ((results.data ?? []) as Result[]).map((r) => ({ ...r, cost_usd: Number(r.cost_usd) })),
    };
  },

  async createAgency(input) {
    const { data, error } = await db().rpc("create_agency", {
      p_name: input.name, p_website: input.website, p_domain: input.domain, p_favicon_url: input.favicon_url,
      p_client_count_band: input.client_count_band, p_regions: input.regions, p_engines: input.engines,
    });
    fail(error);
    return data as Agency;
  },
  async updateAgency(id, patch) {
    const { data, error } = await db().from("agencies").update(patch).eq("id", id).select("*").single();
    fail(error);
    return data as Agency;
  },

  siteMeta: (url) => call("site-meta", { url }),
  generatePrompts: (agencyId, client, count = 10) => call("generate-prompts", { agency_id: agencyId, client, count }),

  async addClients(agencyId, inputs) {
    const { data: clients, error } = await db().from("clients").insert(inputs.map((c) => ({
      agency_id: agencyId, name: c.name, domain: c.domain, website: `https://${c.domain}`, favicon_url: c.favicon_url,
      description: c.description, industry: c.industry, region: c.region,
    }))).select("*");
    fail(error);
    const byDomain = new Map((clients as Client[]).map((c) => [c.domain, c]));
    const compRows = inputs.flatMap((i) => i.competitors.map((x) => ({ agency_id: agencyId, client_id: byDomain.get(i.domain)!.id, name: x.name, domain: x.domain })));
    const promptRows = inputs.flatMap((i) => i.prompts.slice(0, 10).map((p, n) => ({ agency_id: agencyId, client_id: byDomain.get(i.domain)!.id, text: p.text, intent: p.intent, source: p.source, position: n })));
    const [comps, prompts] = await Promise.all([
      compRows.length ? db().from("competitors").insert(compRows).select("id, client_id, name, domain") : Promise.resolve({ data: [], error: null }),
      promptRows.length ? db().from("prompts").insert(promptRows).select("*") : Promise.resolve({ data: [], error: null }),
    ]);
    fail(comps.error); fail(prompts.error);
    return { clients: clients as Client[], competitors: (comps.data ?? []) as Competitor[], prompts: (prompts.data ?? []) as Prompt[], results: [] };
  },
  async updateClient(id, patch) {
    const { data, error } = await db().from("clients").update(patch).eq("id", id).select("*").single();
    fail(error);
    return data as Client;
  },
  async deleteClient(id) {
    const { error } = await db().from("clients").delete().eq("id", id);
    fail(error);
  },

  async setCompetitors(agencyId, clientId, list) {
    const del = await db().from("competitors").delete().eq("client_id", clientId);
    fail(del.error);
    if (!list.length) return [];
    const { data, error } = await db().from("competitors").insert(list.map((c) => ({ agency_id: agencyId, client_id: clientId, ...c }))).select("id, client_id, name, domain");
    fail(error);
    return data as Competitor[];
  },

  async addPrompt(agencyId, clientId, text, intent) {
    const { data, error } = await db().from("prompts").insert({ agency_id: agencyId, client_id: clientId, text, intent, source: "manual", position: 99 }).select("*").single();
    if (error?.message.includes("at most 10")) throw new Error("Each client tracks up to 10 prompts. Pause one to add another.");
    fail(error);
    return data as Prompt;
  },
  async updatePrompt(id, patch) {
    const { data, error } = await db().from("prompts").update(patch).eq("id", id).select("*").single();
    if (error?.message.includes("at most 10")) throw new Error("Each client tracks up to 10 prompts. Pause one first.");
    fail(error);
    return data as Prompt;
  },
  async deletePrompt(id) {
    const { error } = await db().from("prompts").delete().eq("id", id);
    fail(error);
  },

  runCheck: (agencyId, a) =>
    call("run-llm-check", { agency_id: agencyId, engine: a.engine, ...(a.promptId ? { prompt_id: a.promptId } : { client_id: a.clientId, prompt_text: a.promptText }) }),
  dfsStatus: (agencyId) => call("dfs-status", { agency_id: agencyId }),
  async usage(agencyId) {
    const { data, error } = await db().from("api_usage").select("provider, endpoint, status, cost_usd, created_at").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(200);
    fail(error);
    return (data ?? []).map((r) => ({ ...r, cost_usd: Number(r.cost_usd) }));
  },

  async invite(agencyId, email, role) {
    const { data, error } = await db().from("agency_invites").insert({ agency_id: agencyId, email: email.toLowerCase(), role }).select("id, email, role, created_at").single();
    if (error?.message.includes("seats")) throw new Error(error.message + ". Upgrade your plan to add more.");
    if (error?.code === "23505") throw new Error("That person already has an invite.");
    fail(error);
    return data as Invite;
  },
  async revokeInvite(id) {
    const { error } = await db().from("agency_invites").delete().eq("id", id);
    fail(error);
  },
  async removeMember(agencyId, userId) {
    const { error } = await db().from("agency_members").delete().eq("agency_id", agencyId).eq("user_id", userId);
    fail(error);
  },
};
