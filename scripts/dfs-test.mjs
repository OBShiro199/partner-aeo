#!/usr/bin/env node
// One-query-at-a-time DataForSEO tester with a hard local budget.
//
//   npm run dfs -- balance                         free: account balance
//   npm run dfs -- models chatgpt                  free: models the engine accepts
//   npm run dfs -- ask chatgpt "best crm for plumbers" --brand "Daygent" --domain usedaygent.com
//
// Paid "ask" calls are capped at MAX_CALLS (3) and MAX_SPEND ($0.30), tracked in .dfs-usage.json.
// Run with npm run dfs (tsx). Credentials come from .env.local: DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MAX_CALLS = 3;
const MAX_SPEND = 0.3;
const USAGE_FILE = ".dfs-usage.json";
const ENGINES = {
  chatgpt: { path: "chat_gpt", model: "gpt-4.1-mini", webSearch: true },
  claude: { path: "claude", model: "claude-haiku-4-5", webSearch: true },
  gemini: { path: "gemini", model: "gemini-2.5-flash", webSearch: true },
  perplexity: { path: "perplexity", model: "sonar", webSearch: false },
};

function env() {
  const out = { ...process.env };
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const e = env();
if (!e.DATAFORSEO_LOGIN || !e.DATAFORSEO_PASSWORD) {
  console.error("Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local");
  process.exit(1);
}
const AUTH = "Basic " + Buffer.from(`${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`).toString("base64");
const usage = existsSync(USAGE_FILE) ? JSON.parse(readFileSync(USAGE_FILE, "utf8")) : { calls: [], spent: 0 };

async function dfs(path, body) {
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const [cmd, engine, prompt] = process.argv.slice(2);

if (cmd === "balance") {
  const r = await dfs("appendix/user_data");
  const money = r?.tasks?.[0]?.result?.[0]?.money;
  console.log(`Balance: $${money?.balance ?? "?"}  ·  local test budget: ${usage.calls.length}/${MAX_CALLS} calls, $${usage.spent.toFixed(4)}/${MAX_SPEND}`);
} else if (cmd === "models") {
  const cfg = ENGINES[engine];
  if (!cfg) throw new Error(`engine must be one of ${Object.keys(ENGINES).join(", ")}`);
  const r = await dfs(`ai_optimization/${cfg.path}/llm_responses/models`);
  const list = r?.tasks?.[0]?.result ?? [];
  console.log(`${engine}: ${list.length} models · cost $${r?.cost ?? 0}`);
  for (const m of list) console.log(" ", m.model_name ?? JSON.stringify(m), m.web_search_supported ? "(web search)" : "");
} else if (cmd === "ask") {
  const cfg = ENGINES[engine];
  if (!cfg || !prompt) throw new Error('usage: ask <engine> "<prompt>" [--brand Name --domain site.com --model id]');
  if (usage.calls.length >= MAX_CALLS || usage.spent >= MAX_SPEND) {
    console.error(`Stopped: test budget used (${usage.calls.length}/${MAX_CALLS} calls, $${usage.spent.toFixed(4)}). Delete ${USAGE_FILE} to reset on purpose.`);
    process.exit(2);
  }
  const task = { user_prompt: prompt, model_name: arg("model") ?? cfg.model, max_output_tokens: 700 };
  if (cfg.webSearch) task.web_search = true;
  const t0 = Date.now();
  let r = await dfs(`ai_optimization/${cfg.path}/llm_responses/live`, [task]);
  let t = r?.tasks?.[0];
  if (t && [40501, 40503].includes(t.status_code)) {
    console.log(`(${t.status_code} ${t.status_message}; retrying with only user_prompt + model_name)`);
    r = await dfs(`ai_optimization/${cfg.path}/llm_responses/live`, [{ user_prompt: prompt, model_name: task.model_name }]);
    t = r?.tasks?.[0];
  }
  const cost = Number(t?.cost ?? 0);
  usage.calls.push({ at: new Date().toISOString(), engine, prompt, cost, status: t?.status_code });
  usage.spent += cost;
  writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
  writeFileSync(`.dfs-last-${engine}.json`, JSON.stringify(r, null, 2));

  console.log(`status ${t?.status_code} ${t?.status_message} · ${Date.now() - t0}ms · cost $${cost}`);
  const { extractDfs, analyse } = await import("../supabase/functions/_shared/analyse.ts");
  const { text, citations } = extractDfs(t?.result?.[0]);
  console.log("\n--- answer ---\n" + text.slice(0, 2500) + (text.length > 2500 ? "\n…" : ""));
  console.log(`\n--- ${citations.length} citations ---`);
  for (const c of citations.slice(0, 12)) console.log(" ", c.domain, c.url);
  const brand = arg("brand");
  if (brand) {
    const a = analyse(text, citations, { name: brand, domain: arg("domain") ?? brand }, []);
    console.log(`\n--- ${brand} ---\nmentioned: ${a.mentioned} · position: ${a.position ?? "-"} · own site cited: ${a.own_domain_cited}`);
  }
  console.log(`\nBudget: ${usage.calls.length}/${MAX_CALLS} calls · $${usage.spent.toFixed(4)} of $${MAX_SPEND}`);
  console.log(`Raw response saved to .dfs-last-${engine}.json`);
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 9).join("\n"));
}
