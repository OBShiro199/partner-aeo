// Prospect audit maths. Pure TypeScript: the edge functions build reports with it,
// and the Next.js app imports the types (and the PDF renderer uses the same shapes).
import { analyse, domainOf, visibility, type Citation } from "./analyse.ts";

export const AUDIT_ENGINES = ["chatgpt", "perplexity", "gemini", "claude"] as const;
export type AuditEngine = (typeof AUDIT_ENGINES)[number];
export const ENGINE_LABEL: Record<string, string> = { chatgpt: "ChatGPT", perplexity: "Perplexity", gemini: "Gemini", claude: "Claude" };

export type Brand = { name: string; domain: string };

// One prompt asked on one engine.
export type Cell = {
  prompt: string;
  engine: string;
  ok: boolean;
  text: string;
  citations: Citation[];
  prospect: boolean;
  prospect_cited: boolean;
  position: number | null;
  competitor: boolean;
  competitor_cited: boolean;
  cost_usd: number;
  error?: string;
};

export type Risk = "high" | "at_risk" | "visible";
export const RISK_LABEL: Record<Risk, string> = { high: "High risk", at_risk: "At risk", visible: "Visible" };

// What the prospect sees: on the widget, and in the 3-page PDF.
export type ProspectReport = {
  prospect: Brand;
  competitor: Brand | null;
  keyword: string;
  region: string;
  score: number;
  risk: Risk;
  deflection_rate: number | null;        // share of answers naming the competitor but not the prospect
  answers: number;
  engines: { engine: string; answers: number; prospect: number; competitor: number }[];
  prompts: { text: string; engines: string[]; prospect_seen: boolean; competitor_seen: boolean }[];
  gaps: { domain: string; url: string; title?: string; count: number; with_competitor: boolean; with_prospect: boolean }[];
  generated_at: string;
};

// Agency-only data hub.
export type Variation = { prompt: string; keyword: string; intent: string; volume: number | null; trend: number[] | null };
export type Sentiment = { sentiment: "positive" | "neutral" | "negative" | "absent"; adjectives: string[]; summary: string };
export type Hub = {
  cells?: Cell[];
  variations?: Variation[];
  category?: string | null;
  citation_map?: { url: string; domain: string; title?: string; count: number; engines: string[]; with_competitor: boolean; with_prospect: boolean }[];
  sentiment?: { prospect: Sentiment; competitor: Sentiment | null; source: "llm_mentions" | "answers" };
  mentions?: { prospect: MentionSummary | null; competitor: MentionSummary | null } | null;
  notes?: string[];                      // honest caveats: skipped engines, budget stops
};
export type MentionSummary = { total: number | null; questions: { question: string; platform: string; volume: number | null }[] };

export type SalesKit = {
  cold_email?: { subject: string; body: string };
  talk_track?: string;
  closing_script?: { slide: string; say: string }[];
  source?: "haiku" | "template";
};

// Fixed deck structure. The app builds the editable .pptx from these and the report data.
export const DECK_SLIDES = [
  "Title",
  "Buyers now ask AI",
  "Your AI Search Score",
  "Share of voice",
  "Where you're invisible",
  "Where AI gets its answers",
  "The plan",
  "Next steps",
] as const;

export function cellFromAnswer(
  prompt: string, engine: string, text: string, citations: Citation[], prospect: Brand, competitor: Brand | null, cost: number,
): Cell {
  const comps = competitor ? [{ name: competitor.name, domain: competitor.domain }] : [];
  const a = analyse(text, citations, prospect, comps);
  const compDomain = competitor?.domain ?? "";
  return {
    prompt, engine, ok: true, text, citations,
    prospect: a.mentioned, prospect_cited: a.own_domain_cited, position: a.position,
    competitor: a.competitors_mentioned.length > 0,
    competitor_cited: !!compDomain && citations.some((c) => c.domain === compDomain || c.domain.endsWith("." + compDomain)),
    cost_usd: cost,
  };
}

export function riskOf(score: number): Risk {
  return score < 20 ? "high" : score < 50 ? "at_risk" : "visible";
}

export function buildReport(cells: Cell[], o: { prospect: Brand; competitor: Brand | null; keyword: string; region: string; prompts: string[] }): ProspectReport {
  const ok = cells.filter((c) => c.ok);
  const score = Math.round(visibility(ok.map((c) => ({ status: "done", mentioned: c.prospect, own_domain_cited: c.prospect_cited }))) ?? 0);
  const deflected = ok.filter((c) => c.competitor && !c.prospect).length;

  const engines = [...new Set(ok.map((c) => c.engine))].map((engine) => {
    const rows = ok.filter((c) => c.engine === engine);
    return { engine, answers: rows.length, prospect: rows.filter((c) => c.prospect).length, competitor: rows.filter((c) => c.competitor).length };
  });

  const prompts = o.prompts.map((text) => {
    const rows = ok.filter((c) => c.prompt === text);
    return { text, engines: rows.map((c) => c.engine), prospect_seen: rows.some((c) => c.prospect), competitor_seen: rows.some((c) => c.competitor) };
  }).filter((p) => p.engines.length);

  return {
    prospect: o.prospect, competitor: o.competitor, keyword: o.keyword, region: o.region,
    score, risk: riskOf(score),
    deflection_rate: o.competitor && ok.length ? deflected / ok.length : null,
    answers: ok.length, engines, prompts,
    gaps: citationMap(ok, o.prospect, o.competitor).filter((g) => !g.with_prospect).slice(0, 8)
      .map(({ engines: _e, ...g }) => g),
    generated_at: new Date().toISOString(),
  };
}

// Every page the engines cited, excluding the two brands' own sites.
export function citationMap(cells: Cell[], prospect: Brand, competitor: Brand | null) {
  const own = new Set([prospect.domain, competitor?.domain].filter(Boolean) as string[]);
  const m = new Map<string, { url: string; domain: string; title?: string; count: number; engines: Set<string>; with_competitor: boolean; with_prospect: boolean }>();
  for (const c of cells) {
    for (const cit of c.citations) {
      const d = cit.domain || domainOf(cit.url);
      if (!d || [...own].some((o) => d === o || d.endsWith("." + o))) continue;
      const key = cit.url.replace(/[#?].*$/, "");
      const row = m.get(key) ?? { url: key, domain: d, title: cit.title, count: 0, engines: new Set<string>(), with_competitor: false, with_prospect: false };
      row.count++;
      row.engines.add(c.engine);
      row.with_competitor ||= c.competitor;
      row.with_prospect ||= c.prospect;
      m.set(key, row);
    }
  }
  return [...m.values()]
    .map((r) => ({ ...r, engines: [...r.engines] }))
    .sort((a, b) => Number(b.with_competitor && !b.with_prospect) - Number(a.with_competitor && !a.with_prospect) || b.count - a.count);
}

export function brandFromDomain(domain: string, name?: string | null): Brand {
  const root = domain.split(".")[0];
  return { domain, name: (name && name.trim()) || root.charAt(0).toUpperCase() + root.slice(1) };
}

// "Acme | Plumbing in Leeds" -> "Acme". Falls back to the domain root.
export function nameFromTitle(title: string | null | undefined, domain: string): string {
  const root = domain.split(".")[0];
  if (!title) return brandFromDomain(domain).name;
  const parts = title.split(/\s[|\-–—:·]\s/).map((s) => s.trim()).filter(Boolean);
  const match = parts.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(root.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const pick = match ?? parts[0] ?? "";
  return pick.length >= 2 && pick.length <= 40 ? pick : brandFromDomain(domain).name;
}

export const LOCATION_CODES: Record<string, number> = {
  GB: 2826, US: 2840, CA: 2124, AU: 2036, IE: 2372, NZ: 2554, DE: 2276, FR: 2250, ES: 2724, IT: 2380, NL: 2528, SE: 2752, IN: 2356, ZA: 2710, AE: 2784, SG: 2702,
};
