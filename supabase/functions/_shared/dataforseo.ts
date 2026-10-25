// DataForSEO AI Optimization: LLM Responses (live). Basic auth from function secrets.
// Docs: https://docs.dataforseo.com/v3/ai_optimization-chat_gpt-llm_responses-live/
// Price: $0.0006 per task + the model's own token cost (returned per task as `cost`).

export const DFS_ENGINES = {
  chatgpt: { path: "chat_gpt", model: "gpt-4.1-mini", webSearch: true },
  claude: { path: "claude", model: "claude-haiku-4-5", webSearch: true },
  gemini: { path: "gemini", model: "gemini-2.5-flash", webSearch: true },
  perplexity: { path: "perplexity", model: "sonar", webSearch: false },  // searches by default
} as const;
export type DfsEngine = keyof typeof DFS_ENGINES;

export function isDfsEngine(e: string): e is DfsEngine {
  return e in DFS_ENGINES;
}

function auth() {
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const password = Deno.env.get("DATAFORSEO_PASSWORD");
  if (!login || !password) return null;
  return "Basic " + btoa(`${login}:${password}`);
}

export function dfsConfigured() {
  return auth() !== null;
}

// Override default models without redeploying: DFS_MODELS='{"chatgpt":"gpt-4o-mini"}'
function modelFor(engine: DfsEngine): string {
  try {
    const o = JSON.parse(Deno.env.get("DFS_MODELS") ?? "{}");
    if (typeof o[engine] === "string") return o[engine];
  } catch { /* ignore */ }
  return DFS_ENGINES[engine].model;
}

export type DfsResponse = {
  ok: boolean;
  http_status: number;
  status_code: number | null;
  status_message: string;
  cost_usd: number;
  model: string;
  result: unknown;
  ms: number;
};

export async function llmResponse(engine: DfsEngine, prompt: string): Promise<DfsResponse> {
  const header = auth();
  if (!header) throw new Error("DataForSEO credentials are not set");
  const cfg = DFS_ENGINES[engine];
  const model = modelFor(engine);
  const url = `https://api.dataforseo.com/v3/ai_optimization/${cfg.path}/llm_responses/live`;

  const send = async (task: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: header, "Content-Type": "application/json" },
      body: JSON.stringify([task]),
      signal: AbortSignal.timeout(110_000),
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

  const started = Date.now();
  const full: Record<string, unknown> = { user_prompt: prompt, model_name: model, max_output_tokens: 1500 };
  if (cfg.webSearch) full.web_search = true;
  let { res, body } = await send(full);
  let task = body?.tasks?.[0];

  // 40501/40503 = invalid or unsupported field. Failed tasks aren't billed, so retry minimal once.
  if (task && [40501, 40503].includes(task.status_code)) {
    ({ res, body } = await send({ user_prompt: prompt, model_name: model }));
    task = body?.tasks?.[0];
  }

  const ok = res.ok && task?.status_code === 20000;
  return {
    ok,
    http_status: res.status,
    status_code: task?.status_code ?? body?.status_code ?? null,
    status_message: task?.status_message ?? body?.status_message ?? res.statusText,
    cost_usd: Number(task?.cost ?? body?.cost ?? 0),
    model,
    result: task?.result?.[0] ?? null,
    ms: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// Other AI Optimization endpoints used by the Strategy Engine.
// ---------------------------------------------------------------------------

type DfsTask = { ok: boolean; http_status: number; status_code: number | null; status_message: string; cost_usd: number; result: unknown; ms: number };

async function post(path: string, task: Record<string, unknown>, timeout = 60_000): Promise<DfsTask> {
  const header = auth();
  if (!header) throw new Error("DataForSEO credentials are not set");
  const started = Date.now();
  const res = await fetch(`https://api.dataforseo.com/v3/ai_optimization/${path}`, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(timeout),
  });
  const body = await res.json().catch(() => ({}));
  const t = body?.tasks?.[0];
  return {
    ok: res.ok && t?.status_code === 20000,
    http_status: res.status,
    status_code: t?.status_code ?? body?.status_code ?? null,
    status_message: t?.status_message ?? body?.status_message ?? res.statusText,
    cost_usd: Number(t?.cost ?? 0),
    result: t?.result?.[0] ?? null,
    ms: Date.now() - started,
  };
}

// AI Keyword Data: monthly AI search volume per keyword. Measured: $0.0103 for 3 keywords.
// Response: result[0].items[] = { keyword, ai_search_volume, ai_monthly_searches: [{ year, month, ai_search_volume }] }
export async function aiKeywordVolume(keywords: string[], locationCode: number) {
  const r = await post("ai_keyword_data/keywords_search_volume/live", {
    keywords: keywords.slice(0, 1000), location_code: locationCode, language_code: "en",
  });
  const items = ((r.result as { items?: unknown[] })?.items ?? []) as {
    keyword: string; ai_search_volume: number | null; ai_monthly_searches?: { year: number; month: number; ai_search_volume: number | null }[];
  }[];
  const volumes = new Map(items.map((i) => [i.keyword.toLowerCase(), {
    volume: i.ai_search_volume ?? null,
    trend: (i.ai_monthly_searches ?? []).slice().sort((a, b) => a.year - b.year || a.month - b.month).map((m) => m.ai_search_volume ?? 0),
  }]));
  return { ...r, volumes };
}

// LLM Mentions: questions where AI answers mention a domain. Platforms: "chat_gpt" | "google".
// Billed per request plus per row (about $0.10 + $0.001 per row on the public price list).
export async function llmMentions(domain: string, locationCode: number, limit = 10) {
  const r = await post("llm_mentions/search/live", {
    target: [{ domain }], platform: "chat_gpt", location_code: locationCode, language_code: "en", limit,
  });
  const res = r.result as { total_count?: number; items?: Record<string, unknown>[] } | null;
  const items = (res?.items ?? []).map((i) => ({
    question: String(i.question ?? i.user_prompt ?? ""),
    answer: String(i.answer ?? i.response ?? ""),
    platform: String(i.platform ?? "chat_gpt"),
    volume: typeof i.ai_search_volume === "number" ? i.ai_search_volume : null,
  })).filter((i) => i.question);
  return { ...r, total: res?.total_count ?? null, items };
}
