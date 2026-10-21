// Shared helpers for edge functions: CORS, auth, membership, usage logging.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Service-role client: bypasses RLS, so every query below checks membership itself.
export function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function requireUser(req: Request, db: SupabaseClient) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Sign in again.");
  return data.user;
}

export async function requireMember(db: SupabaseClient, agencyId: string, userId: string) {
  const { data } = await db
    .from("agency_members")
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new HttpError(403, "You are not a member of this agency.");
  return data.role as "owner" | "admin" | "member";
}

export async function logUsage(
  db: SupabaseClient,
  row: {
    agency_id: string | null;
    provider: "dataforseo" | "anthropic" | "site";
    endpoint: string;
    status: "ok" | "error" | "blocked";
    http_status?: number | null;
    cost_usd?: number;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await db.from("api_usage").insert({ cost_usd: 0, meta: {}, ...row });
  if (error) console.error("usage log failed", error.message);
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
    }
  };
}

export function normaliseDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  const host = new URL(s).hostname.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new HttpError(400, "Enter a domain like acme.com.");
  return host;
}

// Fetch a public website (no private hosts), returning HTML capped at 400 KB.
export async function fetchSite(domain: string, path = "/"): Promise<string | null> {
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(domain)) return null;
  try {
    const res = await fetch(`https://${domain}${path}`, {
      headers: { "User-Agent": "PartnerAEO/1.0 (+site profile)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder().decode(buf.slice(0, 400_000));
  } catch {
    return null;
  }
}

export function htmlToText(html: string, max = 6000): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
