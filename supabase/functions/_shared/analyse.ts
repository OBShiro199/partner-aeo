// Pure scoring logic. No Deno or Node APIs, so the Next.js app imports it too.

export type Citation = { url: string; domain: string; title?: string };

export type Analysis = {
  mentioned: boolean;
  position: number | null;
  competitors_mentioned: string[];
  own_domain_cited: boolean;
};

const STOP_SUFFIXES = /\b(ltd|limited|inc|llc|plc|co|corp|gmbh|group|uk|hq)\.?$/i;

export function brandVariants(name: string, domain: string, aliases: string[] = []): string[] {
  const base = name.trim().replace(STOP_SUFFIXES, "").trim();
  const root = domain.replace(/^www\./, "").split(".")[0];
  return [...new Set([name, base, domain, root.length > 3 ? root : "", ...aliases].map((s) => s.trim()).filter(Boolean))];
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function firstIndexOf(text: string, variants: string[]): number {
  let best = -1;
  for (const v of variants) {
    const m = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(v)}($|[^\\p{L}\\p{N}])`, "iu").exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Position = which list item the brand first appears in, when the answer is a list.
function listPosition(text: string, variants: string[]): number | null {
  const lines = text.split(/\n/);
  let item = 0;
  for (const line of lines) {
    // A list item: "1. X", "- X", "### X", or a line that opens with a bold name ("**X**", not a "**Heading:**").
    if (/^\s*(\d+[.)]|[-*•])\s+/.test(line) || /^\s*#{2,4}\s+/.test(line) || /^\s*\*\*[^*]+[^:*]\*\*(?!:)/.test(line)) {
      item++;
      if (firstIndexOf(line, variants) >= 0) return item;
    }
  }
  return null;
}

export function analyse(
  text: string,
  citations: Citation[],
  brand: { name: string; domain: string; aliases?: string[] },
  competitors: { name: string; domain?: string | null }[],
): Analysis {
  const variants = brandVariants(brand.name, brand.domain, brand.aliases);
  const own = brand.domain.replace(/^www\./, "").toLowerCase();
  const own_domain_cited = citations.some((c) => c.domain === own || c.domain.endsWith("." + own));
  const mentioned = firstIndexOf(text, variants) >= 0;
  const position = mentioned ? listPosition(text, variants) : null;
  const competitors_mentioned = competitors
    .filter((c) => firstIndexOf(text, brandVariants(c.name, c.domain ?? c.name)) >= 0 ||
      (c.domain && citations.some((x) => x.domain === c.domain)))
    .map((c) => c.name);
  return { mentioned, position, competitors_mentioned, own_domain_cited };
}

export type Outcome = "win" | "partial" | "loss" | "failed" | "pending";

export function outcomeOf(r: { status: string; mentioned: boolean | null; position: number | null; own_domain_cited: boolean }): Outcome {
  if (r.status === "failed" || r.status === "skipped") return "failed";
  if (r.status !== "done") return "pending";
  if (r.mentioned && (r.position === null || r.position <= 3)) return "win";
  if (r.mentioned || r.own_domain_cited) return "partial";
  return "loss";
}

// Visibility (0-100) = 70 x mention rate + 30 x citation rate, over finished answers.
export function visibility(rows: { status: string; mentioned: boolean | null; own_domain_cited: boolean }[]): number | null {
  const done = rows.filter((r) => r.status === "done");
  if (!done.length) return null;
  const m = done.filter((r) => r.mentioned).length / done.length;
  const c = done.filter((r) => r.own_domain_cited).length / done.length;
  return Math.round((70 * m + 30 * c) * 10) / 10;
}

// Pull plain text and cited URLs out of a DataForSEO LLM Responses result, whatever its exact shape.
export function extractDfs(result: unknown): { text: string; citations: Citation[] } {
  const texts: string[] = [];
  const urls = new Map<string, Citation>();
  const walk = (node: unknown, depth: number) => {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    // Annotations carry the cited snippet in `text` too; only take text from blocks without a url.
    if (typeof o.text === "string" && o.text.length > 0 && typeof o.url !== "string") texts.push(o.text);
    if (typeof o.url === "string" && /^https?:\/\//.test(o.url)) {
      // Gemini cites Google redirect links; the real page is in direct_url.
      const url = typeof o.direct_url === "string" && /^https?:\/\//.test(o.direct_url) ? o.direct_url : o.url;
      const d = domainOf(url);
      if (d && !urls.has(url)) urls.set(url, { url, domain: d, title: typeof o.title === "string" ? o.title : undefined });
    }
    for (const [k, v] of Object.entries(o)) if (k !== "text" && typeof v === "object") walk(v, depth + 1);
  };
  walk((result as Record<string, unknown>)?.items ?? result, 0);
  return { text: texts.join("\n\n").trim(), citations: [...urls.values()].slice(0, 40) };
}
