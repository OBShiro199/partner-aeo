// POST { agency_id, prompt_id, engine }            -> runs one tracked prompt on one engine
// POST { agency_id, client_id, prompt_text, engine } -> ad-hoc test from the API console
//
// While testing, the platform allows exactly one prompt x one engine per request and a
// hard total of platform_limits.dfs_max_calls paid calls (default 3, about $0.30 max).
import { admin, handle, HttpError, json, logUsage, requireMember, requireUser } from "../_shared/common.ts";
import { analyse, extractDfs } from "../_shared/analyse.ts";
import { dfsConfigured, isDfsEngine, llmResponse } from "../_shared/dataforseo.ts";

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  await requireMember(db, agencyId, user.id);

  const engine = String(body.engine ?? "");
  if (!isDfsEngine(engine)) throw new HttpError(400, `${engine || "That engine"} can't be tracked yet. Pick ChatGPT, Claude, Gemini or Perplexity.`);
  if (!dfsConfigured()) throw new HttpError(503, "DataForSEO isn't connected. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD as function secrets.");

  // Resolve the prompt and client, scoped to this agency.
  let promptId: string | null = null;
  let promptText: string;
  let clientId: string;
  if (body.prompt_id) {
    const { data: p } = await db.from("prompts").select("id, text, client_id").eq("id", body.prompt_id).eq("agency_id", agencyId).maybeSingle();
    if (!p) throw new HttpError(404, "That prompt no longer exists.");
    promptId = p.id; promptText = p.text; clientId = p.client_id;
  } else {
    promptText = String(body.prompt_text ?? "").trim().slice(0, 400);
    clientId = String(body.client_id ?? "");
    if (promptText.length < 3) throw new HttpError(400, "Write a prompt to test.");
  }
  const { data: client } = await db.from("clients").select("id, name, domain, aliases").eq("id", clientId).eq("agency_id", agencyId).maybeSingle();
  if (!client) throw new HttpError(404, "That client no longer exists.");
  const { data: competitors } = await db.from("competitors").select("name, domain").eq("client_id", clientId);

  // Spend guard. Counts every paid DataForSEO call ever made on this project.
  const [{ data: limits }, { data: used }] = await Promise.all([
    db.from("platform_limits").select("*").single(),
    db.from("api_usage").select("cost_usd").eq("provider", "dataforseo").eq("status", "ok"),
  ]);
  const calls = used?.length ?? 0;
  const spent = (used ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  if (limits && (calls >= limits.dfs_max_calls || spent >= Number(limits.dfs_max_spend_usd))) {
    await logUsage(db, { agency_id: agencyId, provider: "dataforseo", endpoint: "llm_responses/live", status: "blocked", meta: { engine, calls, spent } });
    throw new HttpError(402, `Test limit reached: ${calls} of ${limits.dfs_max_calls} checks used ($${spent.toFixed(4)}). Raise platform_limits to run more.`);
  }

  const { data: scan, error: scanErr } = await db.from("scans").insert({
    agency_id: agencyId, client_id: clientId, status: "running", engines: [engine], is_test: !promptId, triggered_by: user.id,
  }).select("id").single();
  if (scanErr) throw scanErr;

  const r = await llmResponse(engine, promptText);
  await logUsage(db, {
    agency_id: agencyId, provider: "dataforseo", endpoint: `${engine}/llm_responses/live`,
    status: r.ok ? "ok" : "error", http_status: r.http_status, cost_usd: r.cost_usd,
    meta: { model: r.model, status_code: r.status_code, status_message: r.status_message, ms: r.ms, scan_id: scan.id },
  });

  const { text, citations } = r.ok ? extractDfs(r.result) : { text: "", citations: [] };
  const a = r.ok ? analyse(text, citations, { name: client.name, domain: client.domain, aliases: client.aliases }, competitors ?? []) : null;

  const { data: result, error: resErr } = await db.from("scan_results").insert({
    agency_id: agencyId, scan_id: scan.id, client_id: clientId, prompt_id: promptId, prompt_text: promptText,
    engine, model: r.model, status: r.ok ? "done" : "failed", response_text: text || null, citations,
    mentioned: a?.mentioned ?? null, position: a?.position ?? null,
    competitors_mentioned: a?.competitors_mentioned ?? [], own_domain_cited: a?.own_domain_cited ?? false,
    cost_usd: r.cost_usd, latency_ms: r.ms, error: r.ok ? null : `${r.status_code}: ${r.status_message}`,
  }).select("*").single();
  if (resErr) throw resErr;

  await db.from("scans").update({
    status: r.ok ? "complete" : "failed", cost_usd: r.cost_usd, finished_at: new Date().toISOString(),
  }).eq("id", scan.id);

  return json({
    result,
    usage: { calls_used: calls + (r.ok ? 1 : 0), calls_max: limits?.dfs_max_calls ?? null, spent_usd: spent + r.cost_usd },
  });
}));
