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
