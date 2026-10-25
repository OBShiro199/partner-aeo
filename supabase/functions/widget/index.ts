// Public. Called by the embedded widget (no sign-in; the widget's public key names the agency).
// POST { key, action: "start", domain, keyword, competitor?, host? } -> { audit_id }
// POST { key, action: "status", audit_id }                              -> teaser (score, risk, deflection)
// POST { key, action: "lead", audit_id, name?, email, phone }          -> { ok }
//
// start takes one widget credit from the agency's monthly allowance; a matching scan from
// the last 7 days is reused instead of paying for fresh answers. lead saves the contact,
// emails the prospect their white-label PDF, alerts the agency's owners and admins, then
// upgrades the audit to a full strategy pack in the background.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { admin, handle, HttpError, json, normaliseDomain } from "../_shared/common.ts";
import { background, checkHost, ipHash, widgetByKey, type Widget } from "../_shared/public.ts";
import { cacheKey, runAudit } from "../_shared/strategy.ts";
import { RISK_LABEL, type ProspectReport } from "../_shared/audit.ts";

const CACHE_DAYS = 7;

Deno.serve(handle(async (req) => {
  const db = admin();
  const body = await req.json().catch(() => ({}));
  const w = await widgetByKey(db, body.key);
  if (body.action === "status") return await status(db, w, String(body.audit_id ?? ""));
  if (body.action === "lead") return await captureLead(db, w, body);
  if (body.action === "start") return await start(db, w, req, body);
  throw new HttpError(400, "Unknown action.");
}));

async function status(db: SupabaseClient, w: Widget, auditId: string) {
  const { data: a } = await db.from("audits").select("id, status, stage, score, risk, deflection_rate, report, error, created_at")
    .eq("id", auditId).eq("widget_id", w.id).maybeSingle();
  if (!a) throw new HttpError(404, "That scan has expired. Start a new one.");
  // A scan stuck for 5 minutes was cut off; report it rather than spin forever.
  if (a.status !== "complete" && a.status !== "failed" && Date.now() - new Date(a.created_at).getTime() > 300_000) {
    return json({ status: "failed", error: "The scan took too long. Try again." });
  }
  if (a.status !== "complete") return json({ status: a.status, stage: a.stage, error: a.error });
  const r = a.report as ProspectReport;
  // Teaser only: the detail is behind the lead gate (PDF by email).
  return json({
    status: "complete", score: a.score, risk: a.risk, risk_label: RISK_LABEL[a.risk as keyof typeof RISK_LABEL],
    deflection_rate: a.deflection_rate == null ? null : Number(a.deflection_rate), answers: r.answers,
    prospect: r.prospect, competitor: r.competitor, invisible: r.prompts.filter((p) => !p.prospect_seen).length, asked: r.prompts.length,
    engines: r.engines.map((e) => e.engine),
  });
}

// deno-lint-ignore no-explicit-any
async function start(db: SupabaseClient, w: Widget, req: Request, body: any) {
  const host = checkHost(w, body.host);
  const domain = normaliseDomain(String(body.domain ?? ""));
  const keyword = String(body.keyword ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (keyword.length < 2) throw new HttpError(400, "Add what you sell, like \"accountants in Leeds\".");
  const competitor = body.competitor ? normaliseDomain(String(body.competitor)) : null;
  if (competitor === domain) throw new HttpError(400, "Pick a competitor that isn't your own site.");
  const region = /^[A-Z]{2}$|^GLOBAL$/.test(String(body.region ?? "")) ? String(body.region) : w.default_region;

  const { data: limits } = await db.from("platform_limits").select("widget_scans_per_ip_hour, widget_scans_per_day").single();
  const ip = await ipHash(req, w.public_key);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await db.from("audits").select("id", { count: "exact", head: true }).eq("ip_hash", ip).gte("created_at", hourAgo);
  if ((recent ?? 0) >= (limits?.widget_scans_per_ip_hour ?? 3)) throw new HttpError(429, "You've run a few scans already. Try again in an hour.");

  const key = await cacheKey(domain, keyword, competitor, region);
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data: cached } = await db.from("audits").select("id, prospect_name, competitor_name, score, risk, deflection_rate, report, hub")
    .eq("cache_key", key).eq("status", "complete").gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!cached) {
    const { count: today } = await db.from("audits").select("id", { count: "exact", head: true })
      .eq("source", "widget").is("cached_from", null).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if ((today ?? 0) >= (limits?.widget_scans_per_day ?? 50)) throw new HttpError(503, "The scanner is busy right now. Try again later today.");
  }

  const { data: audit, error } = await db.from("audits").insert({
    agency_id: w.agency_id, widget_id: w.id, source: "widget", depth: "lite", prospect_domain: domain, keyword,
    competitor_domain: competitor, region, status: cached ? "complete" : "queued", cache_key: key, ip_hash: ip, host,
    ...(cached ? {
      cached_from: cached.id, prospect_name: cached.prospect_name, competitor_name: cached.competitor_name, score: cached.score,
      risk: cached.risk, deflection_rate: cached.deflection_rate, report: cached.report,
      hub: { cells: cached.hub?.cells, variations: cached.hub?.variations?.slice(0, 5), category: cached.hub?.category },
      finished_at: new Date().toISOString(),
    } : {}),
  }).select("id").single();
  if (error) throw error;

  const credit = await db.rpc("consume_credit", { p_agency: w.agency_id, p_kind: "widget_scan", p_audit: audit.id });
  if (!credit.data?.ok) {
    await db.from("audits").delete().eq("id", audit.id);
    throw new HttpError(402, "This scanner has reached its monthly limit. Please contact us directly.");
  }

  if (!cached) background(runAudit(db, audit.id, "lite"));
  return json({ audit_id: audit.id, status: cached ? "complete" : "queued" });
}

// deno-lint-ignore no-explicit-any
async function captureLead(db: SupabaseClient, w: Widget, body: any) {
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone ?? "").replace(/[^\d+()\s-]/g, "").trim().slice(0, 32);
  const name = String(body.name ?? "").trim().slice(0, 120) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (phone.replace(/\D/g, "").length < 6) throw new HttpError(400, "Enter a phone number we can reach you on.");

  const { data: a } = await db.from("audits").select("id, status, report, host, depth")
    .eq("id", String(body.audit_id ?? "")).eq("widget_id", w.id).maybeSingle();
  if (!a || a.status !== "complete") throw new HttpError(404, "That scan has expired. Start a new one.");

  const { data: existing } = await db.from("leads").select("id").eq("audit_id", a.id).maybeSingle();
  if (existing) return json({ ok: true });

  const { data: lead, error } = await db.from("leads").insert({ agency_id: w.agency_id, widget_id: w.id, audit_id: a.id, name, email, phone }).select("id").single();
  if (error) throw error;

  const r = a.report as ProspectReport;
  const first = name?.split(" ")[0] ?? null;
  await db.rpc("enqueue_email", { p_kind: "prospect_report", p_to: email, p_agency: w.agency_id, p_user: null, p_data: { audit_id: a.id, lead_id: lead.id, first_name: first }, p_dedupe: `prospect_report:${a.id}` });

  const { data: admins } = await db.from("agency_members").select("user_id, profiles(email)").eq("agency_id", w.agency_id).in("role", ["owner", "admin"]);
  for (const m of admins ?? []) {
    const to = (m as unknown as { profiles: { email: string } | null }).profiles?.email;
    if (!to) continue;
    await db.rpc("enqueue_email", {
      p_kind: "new_lead", p_to: to, p_agency: w.agency_id, p_user: m.user_id, p_dedupe: `new_lead:${lead.id}:${m.user_id}`,
      p_data: {
        lead_id: lead.id, name, email, phone, prospect_domain: r.prospect.domain, keyword: r.keyword, score: r.score,
        competitor_name: r.competitor?.name ?? null, deflection_pct: r.deflection_rate == null ? null : Math.round(r.deflection_rate * 100), host: a.host,
      },
    });
  }

  // Send now rather than within the minute, then build the agency's strategy pack.
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/email-worker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  if (a.depth !== "full") background(runAudit(db, a.id, "full"));
  return json({ ok: true });
}
