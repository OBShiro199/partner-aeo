// Signed in. The Strategy Engine sandbox in the back office.
// POST { agency_id, prospect_domain, keyword, competitor_domain?, region? } -> { audit_id }  (takes one strategy run)
// POST { agency_id, audit_id }                                               -> { audit_id }  (finish or retry a full pack; free)
import { admin, handle, HttpError, json, normaliseDomain, requireMember, requireUser } from "../_shared/common.ts";
import { background } from "../_shared/public.ts";
import { runAudit } from "../_shared/strategy.ts";

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  await requireMember(db, agencyId, user.id);

  if (body.audit_id) {
    const { data: a } = await db.from("audits").select("id, status, created_at").eq("id", body.audit_id).eq("agency_id", agencyId).maybeSingle();
    if (!a) throw new HttpError(404, "That analysis no longer exists.");
    const stuck = a.status === "running" && Date.now() - new Date(a.created_at).getTime() > 300_000;
    if ((a.status === "running" || a.status === "queued") && !stuck) throw new HttpError(409, "That analysis is already running.");
    await db.from("audits").update({ status: "running", stage: "Starting", error: null }).eq("id", a.id);
    background(runAudit(db, a.id, "full"));
    return json({ audit_id: a.id });
  }

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
