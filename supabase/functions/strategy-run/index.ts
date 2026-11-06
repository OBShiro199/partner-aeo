// Signed in. The Strategy Engine sandbox in the back office.
// POST { agency_id, prospect_domain, keyword, competitor_domain?, region? } -> { audit_id }  (takes one strategy run)
// POST { agency_id, audit_id, depth? }                                       -> { audit_id }  (finish or retry an audit; free)
// Paid plans only, except the "lite" runs that finish the free trial sprint.
import { admin, handle, HttpError, json, normaliseDomain, requireMember, requireUser } from "../_shared/common.ts";
import { background } from "../_shared/public.ts";
import { runAudit } from "../_shared/strategy.ts";

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  await requireMember(db, agencyId, user.id);

  const { data: agency } = await db.from("agencies").select("plan").eq("id", agencyId).single();
  const trial = (agency?.plan ?? "trial") === "trial";

  if (body.audit_id) {
    // Finish an audit: "lite" for the free sprint's answer checks, "full" (the default) for a strategy pack.
    const depth = body.depth === "lite" ? "lite" : "full";
    if (depth === "full" && trial) throw new HttpError(402, "The full strategy pack (deck, 25-prompt blueprint and sales scripts) is on paid plans. Upgrade to unlock it.");
    const { data: a } = await db.from("audits").select("id, status, depth, started_at").eq("id", body.audit_id).eq("agency_id", agencyId).maybeSingle();
    if (!a) throw new HttpError(404, "That analysis no longer exists.");
    const stuck = Date.now() - new Date(a.started_at).getTime() > 300_000;
    if (a.status === "running" && !stuck) throw new HttpError(409, "That analysis is already running.");
    if (a.status === "complete" && (a.depth === "full" || depth === "lite")) throw new HttpError(409, "That analysis is already complete.");
    await db.from("audits").update({ status: "queued", stage: "Starting", error: null, started_at: new Date().toISOString() }).eq("id", a.id);
    background(runAudit(db, a.id, depth));
    return json({ audit_id: a.id });
  }

  if (trial) throw new HttpError(402, "The Strategy Engine is on paid plans. Your trial includes the free client audit and 5 leads.");
  const domain = normaliseDomain(String(body.prospect_domain ?? ""));
  const keyword = String(body.keyword ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (keyword.length < 2) throw new HttpError(400, "Add a seed keyword, like \"ai receptionist\".");
  const competitor = body.competitor_domain ? normaliseDomain(String(body.competitor_domain)) : null;
  if (competitor === domain) throw new HttpError(400, "The competitor must be a different site.");
  const region = /^[A-Z]{2}$|^GLOBAL$/.test(String(body.region ?? "")) ? String(body.region) : "GB";

  const { data: audit, error } = await db.from("audits").insert({
    agency_id: agencyId, source: "manual", depth: "full", prospect_domain: domain, keyword, competitor_domain: competitor,
    region, status: "queued", stage: "Starting", triggered_by: user.id,
  }).select("id").single();
  if (error) throw error;

  const credit = await db.rpc("consume_credit", { p_agency: agencyId, p_kind: "strategy_run", p_audit: audit.id });
  if (!credit.data?.ok) {
    await db.from("audits").delete().eq("id", audit.id);
    throw new HttpError(402, `You've used all ${credit.data?.allowance ?? ""} strategy runs this month. Turn on overage in Billing to keep going.`.replace("  ", " "));
  }
  background(runAudit(db, audit.id, "full"));
  return json({ audit_id: audit.id, overage: credit.data.overage === true });
}));
