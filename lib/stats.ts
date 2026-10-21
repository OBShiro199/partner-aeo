import type { Client, Competitor, Prompt, Result } from "./types";
import { outcomeOf, visibility, type Outcome } from "../supabase/functions/_shared/analyse";

export { outcomeOf, visibility, type Outcome };

const DAY = 86_400_000;

export function inRange(r: Result, days: number, now = Date.now()) {
  return now - new Date(r.created_at).getTime() <= days * DAY;
}

// The newest finished answer for each client x prompt x engine.
export function latest(results: Result[]): Result[] {
  const map = new Map<string, Result>();
  for (const r of results) {
    if (r.status !== "done" && r.status !== "failed") continue;
    const k = `${r.client_id}|${r.prompt_id ?? r.prompt_text}|${r.engine}`;
    const cur = map.get(k);
    if (!cur || cur.created_at < r.created_at) map.set(k, r);
  }
  return [...map.values()];
}

export type Summary = {
  answers: number;
  mentions: number;
  mentionRate: number | null;
  citationRate: number | null;
  avgPosition: number | null;
  visibility: number | null;
};

export function summarize(rows: Result[]): Summary {
  const done = rows.filter((r) => r.status === "done");
  const mentions = done.filter((r) => r.mentioned).length;
  const positions = done.filter((r) => r.mentioned && r.position != null).map((r) => r.position!);
  return {
    answers: done.length,
    mentions,
    mentionRate: done.length ? mentions / done.length : null,
    citationRate: done.length ? done.filter((r) => r.own_domain_cited).length / done.length : null,
    avgPosition: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
    visibility: visibility(done),
  };
}

export function byEngine(rows: Result[], engines: string[]) {
  return engines.map((id) => ({ id, ...summarize(rows.filter((r) => r.engine === id)) }));
}

// Weekly visibility, oldest first. Each week uses the newest answer per prompt x engine within it.
export function weeklyTrend(results: Result[], weeks = 8, now = Date.now()) {
  const out: { start: number; label: string; value: number | null; answers: number }[] = [];
  const end = now;
  for (let i = weeks - 1; i >= 0; i--) {
    const to = end - i * 7 * DAY;
    const from = to - 7 * DAY;
    const rows = latest(results.filter((r) => { const t = new Date(r.created_at).getTime(); return t > from && t <= to; }));
    const s = summarize(rows);
    out.push({ start: from, label: new Date(from + DAY).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: s.visibility, answers: s.answers });
  }
  return out;
}

export function shareOfVoice(rows: Result[], clients: Client[], competitors: Competitor[]) {
  const done = rows.filter((r) => r.status === "done");
  const counts = new Map<string, { name: string; count: number; own: boolean; domain: string | null }>();
  for (const c of clients) counts.set("c:" + c.id, { name: c.name, count: 0, own: true, domain: c.domain });
  for (const r of done) {
    if (r.mentioned) counts.get("c:" + r.client_id)!.count++;
    for (const name of r.competitors_mentioned) {
      const comp = competitors.find((x) => x.client_id === r.client_id && x.name === name);
      const k = "x:" + name.toLowerCase();
      const cur = counts.get(k) ?? { name, count: 0, own: false, domain: comp?.domain ?? null };
      cur.count++;
      counts.set(k, cur);
    }
  }
  const list = [...counts.values()].filter((x) => x.count > 0 || x.own);
  const total = list.reduce((s, x) => s + x.count, 0);
  return list
    .map((x) => ({ ...x, share: total ? x.count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function topSources(rows: Result[], limit = 8) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const d of new Set(r.citations.map((c) => c.domain))) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const answers = rows.filter((r) => r.status === "done").length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count, rate: count / answers }));
}

export function promptMatrix(prompts: Prompt[], rows: Result[], engines: string[]) {
  return prompts.map((p) => {
    const cells = engines.map((e) => {
      const r = rows.find((x) => x.prompt_id === p.id && x.engine === e);
      return { engine: e, result: r ?? null, outcome: (r ? outcomeOf(r) : "pending") as Outcome };
    });
    const done = cells.filter((c) => c.result?.status === "done");
    return { prompt: p, cells, wins: done.filter((c) => c.outcome === "win" || c.outcome === "partial").length, scored: done.length };
  });
}

export function clientTable(clients: Client[], results: Result[], days: number, now = Date.now()) {
  return clients.map((c) => {
    const mine = results.filter((r) => r.client_id === c.id);
    const cur = summarize(latest(mine.filter((r) => inRange(r, days, now))));
    const prev = summarize(latest(mine.filter((r) => {
      const age = now - new Date(r.created_at).getTime();
      return age > days * DAY && age <= 2 * days * DAY;
    })));
    const last = mine.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);
    return {
      client: c,
      ...cur,
      delta: cur.visibility != null && prev.visibility != null ? cur.visibility - prev.visibility : null,
      spark: weeklyTrend(mine, 8, now).map((w) => w.value),
      lastChecked: last,
    };
  });
}
