// Weekly digest maths, shared by the email worker. Pure TypeScript.
import { visibility } from "./analyse.ts";

type Row = { client_id: string; prompt_id: string | null; prompt_text: string; engine: string; status: string; mentioned: boolean | null; own_domain_cited: boolean; created_at: string; citations?: { domain: string }[] };

// Newest finished answer per client x prompt x engine.
export function latestPerPrompt<R extends Row>(rows: R[]): R[] {
  const m = new Map<string, R>();
  for (const r of rows) {
    if (r.status !== "done") continue;
    const k = `${r.client_id}|${r.prompt_id ?? r.prompt_text}|${r.engine}`;
    const cur = m.get(k);
    if (!cur || cur.created_at < r.created_at) m.set(k, r);
  }
  return [...m.values()];
}

export function summarise(rows: Row[]) {
  const done = rows.filter((r) => r.status === "done");
  return {
    answers: done.length,
    mentionRate: done.length ? done.filter((r) => r.mentioned).length / done.length : null,
    citationRate: done.length ? done.filter((r) => r.own_domain_cited).length / done.length : null,
    visibility: visibility(done),
  };
}
