// POST { agency_id } -> { configured, balance_usd, calls_used, calls_max, spent_usd, max_spend_usd }
// Reads the DataForSEO account balance (free endpoint) plus how much of the test budget is used.
import { admin, handle, json, requireMember, requireUser } from "../_shared/common.ts";
import { dfsConfigured } from "../_shared/dataforseo.ts";

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const { agency_id } = await req.json();
  await requireMember(db, String(agency_id ?? ""), user.id);

  const [{ data: limits }, { data: used }] = await Promise.all([
    db.from("platform_limits").select("*").single(),
    db.from("api_usage").select("cost_usd").eq("provider", "dataforseo").eq("status", "ok"),
  ]);

  let balance_usd: number | null = null;
  if (dfsConfigured()) {
    try {
      const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        headers: { Authorization: "Basic " + btoa(`${Deno.env.get("DATAFORSEO_LOGIN")}:${Deno.env.get("DATAFORSEO_PASSWORD")}`) },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json();
      balance_usd = Number(body?.tasks?.[0]?.result?.[0]?.money?.balance ?? NaN);
      if (Number.isNaN(balance_usd)) balance_usd = null;
    } catch { /* balance stays null */ }
  }

  return json({
    configured: dfsConfigured(),
    balance_usd,
    calls_used: used?.length ?? 0,
    calls_max: limits?.dfs_max_calls ?? 3,
    spent_usd: (used ?? []).reduce((s, r) => s + Number(r.cost_usd), 0),
    max_spend_usd: Number(limits?.dfs_max_spend_usd ?? 0.3),
  });
}));
