// Technical AI-readiness audit: Cliff's four pillars, checked with plain HTTP requests (no paid APIs).
//   1. AI crawler access   robots.txt rules and live requests as GPTBot, ClaudeBot and PerplexityBot
//   2. Context ingestion   /llms.txt, readable text without JavaScript, page structure
//   3. Entity schema       JSON-LD business type, address and phone, geo, sameAs links
//   4. Conversational      FAQ schema and question-style headings (AI answer visibility is added from the LLM audit)
// Uses only fetch, so it runs in the edge functions and type-checks in the app. Requests come from a data
// centre, so a firewall verdict is a strong signal rather than proof of what the real bots see.

export type CheckStatus = "pass" | "warn" | "fail";
export type PillarKey = "access" | "context" | "entity" | "conversational";
export type TechCheck = { id: string; pillar: PillarKey; label: string; status: CheckStatus; detail: string };
export type TechAudit = {
  url: string;
  reachable: boolean;
  score: number;                                   // 0-100, mean of the pillars
  pillars: { key: PillarKey; label: string; score: number }[];
  checks: TechCheck[];
  checked_at: string;
};

export const PILLAR_LABEL: Record<PillarKey, string> = {
  access: "AI crawler access",
  context: "Context for AI",
  entity: "Entity and schema",
  conversational: "Answer readiness",
};

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const AI_BOTS = [
  { id: "gptbot", name: "GPTBot", token: "gptbot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" },
  { id: "claudebot", name: "ClaudeBot", token: "claudebot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
  { id: "perplexitybot", name: "PerplexityBot", token: "perplexitybot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
] as const;

type Fetched = { status: number; ms: number; body: string; type: string; challenge: boolean; error?: string };

async function get(url: string, ua: string, timeout = 8000): Promise<Fetched> {
  const started = Date.now();
  try {
    // Plain gzip only: some servers answer newer encodings the runtime can't decode, which reads as noise.
    const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,text/plain,*/*", "Accept-Encoding": "gzip, deflate" }, redirect: "follow", signal: AbortSignal.timeout(timeout) });
    const buf = await res.arrayBuffer();
    const raw = new TextDecoder().decode(buf.slice(0, 600_000));
    // Undecodable bytes (binary or an encoding we can't read) are treated as no body at all.
    const garbled = (raw.slice(0, 20_000).match(/\uFFFD|[\u0000-\u0008\u000E-\u001F]/g) ?? []).length > 40;
    const body = garbled ? "" : raw;
    const type = res.headers.get("content-type") ?? "";
    // A challenge page, not a normal page that merely loads Cloudflare's scripts or a reCAPTCHA form.
    const challenge = res.headers.has("cf-mitigated") || /<title>\s*just a moment/i.test(body.slice(0, 5000))
      || (res.status >= 400 && /cf-browser-verification|cf_chl_|challenge-platform|captcha/i.test(body.slice(0, 20_000)));
    return { status: res.status, ms: Date.now() - started, body, type, challenge };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, body: "", type: "", challenge: false, error: String((e as Error).message ?? e).slice(0, 120) };
  }
}

// Is "/" disallowed for this bot? Uses the bot's own group if there is one, else "*".
export function robotsBlocks(robots: string, token: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "disallow" || key === "allow") && cur) {
      cur.rules.push({ allow: key === "allow", path: val });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const own = groups.find((g) => g.agents.some((a) => a.length > 2 && a !== "*" && token.includes(a.replace(/\/.*$/, ""))));
  const group = own ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return false;
  const rootDisallowed = group.rules.some((r) => !r.allow && r.path === "/");
  const rootAllowed = group.rules.some((r) => r.allow && (r.path === "/" || r.path === "/*"));
  return rootDisallowed && !rootAllowed;
}

const strip = (html: string) => html
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

type Node = Record<string, unknown>;
function jsonLd(html: string): Node[] {
  const out: Node[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const push = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(push);
    if (v && typeof v === "object") {
      const o = v as Node;
      out.push(o);
      if (Array.isArray(o["@graph"])) (o["@graph"] as unknown[]).forEach(push);
    }
  };
  while ((m = re.exec(html))) {
    try { push(JSON.parse(m[1].trim())); } catch { /* invalid JSON-LD counts as missing */ }
  }
  return out;
}
const types = (n: Node) => ([] as unknown[]).concat(n["@type"] ?? []).map(String);
const BUSINESS = /LocalBusiness|Organization|Corporation|Store|Restaurant|Dentist|Physician|MedicalBusiness|LegalService|Attorney|HomeAndConstructionBusiness|RoofingContractor|Plumber|Electrician|HVACBusiness|ProfessionalService|AutomotiveBusiness|FinancialService|HealthAndBeautyBusiness|RealEstateAgent|LodgingBusiness|FoodEstablishment/;

const check = (pillar: PillarKey, id: string, label: string, status: CheckStatus, detail: string): TechCheck => ({ id, pillar, label, status, detail });
const HTML = /<html|<body|<head|<!doctype/i;

export async function runTechAudit(domain: string): Promise<TechAudit> {
  const base = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
  const [home, robots, llms, llmsFull, ...bots] = await Promise.all([
    get(base + "/", BROWSER),
    get(base + "/robots.txt", BROWSER, 6000),
    get(base + "/llms.txt", BROWSER, 6000),
    get(base + "/llms-full.txt", BROWSER, 6000),
    ...AI_BOTS.map((b) => get(base + "/", b.ua)),
  ]);
  const checks: TechCheck[] = [];
  const isHtml = HTML.test(home.body.slice(0, 5000));
  const reachable = home.status >= 200 && home.status < 400 && isHtml;
  // A site that doesn't answer at all gets one honest finding, not a page of failures it never had.
  if (!reachable && !bots.some((b) => b.status >= 200 && b.status < 400 && HTML.test(b.body.slice(0, 5000)))) {
    const why = home.status >= 200 && home.status < 400 ? "didn't return a readable web page" : home.status ? `answered ${home.status}` : `didn't respond (${home.error ?? "timeout"})`;
    return {
      url: base, reachable: false, score: 0,
      pillars: (Object.keys(PILLAR_LABEL) as PillarKey[]).map((key) => ({ key, label: PILLAR_LABEL[key], score: 0 })),
      checks: [check("access", "reachable", "Site responds", "fail", `The homepage ${why}, so neither people nor AI crawlers can read it.`)],
      checked_at: new Date().toISOString(),
    };
  }

  // ---- Pillar 1: AI crawler access
  // Content checks read the browser's copy of the page, or a bot's if only the bots got HTML.
  const page = isHtml ? home.body : bots.find((b) => HTML.test(b.body.slice(0, 5000)))?.body ?? "";
  const robotsText = robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500)) ? robots.body : "";
  if (!robotsText) {
    checks.push(robots.status === 0
      ? check("access", "robots", "robots.txt", "warn", "Couldn't read robots.txt.")
      : check("access", "robots", "robots.txt", "pass", "No robots.txt rules, so AI crawlers are allowed by default."));
  }
  for (const b of [...AI_BOTS, { id: "google-extended", name: "Google-Extended", token: "google-extended" }]) {
    if (!robotsText) continue;
    const blocked = robotsBlocks(robotsText, b.token);
    checks.push(check("access", `robots-${b.id}`, `robots.txt allows ${b.name}`, blocked ? "fail" : "pass", blocked ? `robots.txt blocks ${b.name} from the whole site.` : `${b.name} is allowed.`));
  }
  AI_BOTS.forEach((b, i) => {
    const r = bots[i];
    const ok = r.status >= 200 && r.status < 400 && !r.challenge;
    const blocked = r.status === 401 || r.status === 403 || r.status === 429 || r.status === 503 || r.challenge;
    checks.push(check("access", `live-${b.id}`, `${b.name} can load the homepage`, ok ? "pass" : blocked ? "fail" : "warn",
      ok ? `Answered ${r.status} in ${(r.ms / 1000).toFixed(1)}s.`
        : r.challenge ? "A firewall challenge (such as Cloudflare's) stopped the request."
        : r.status ? `Answered ${r.status}${blocked ? ": the bot is refused." : "."}` : `No response (${r.error ?? "timeout"}).`));
  });
  const speed = home.ms;
  checks.push(check("access", "speed", "Homepage response time", !reachable ? "fail" : speed < 1500 ? "pass" : speed < 4000 ? "warn" : "fail",
    reachable ? `${(speed / 1000).toFixed(1)}s to load the page.` : "The homepage didn't load."));

  // ---- Pillar 2: context ingestion
  // A real llms.txt is markdown, not the homepage served for every path.
  const textFile = (f: Fetched) => f.status === 200 && !/text\/html/i.test(f.type) && f.body.trim().length > 20 && !/<html|<body/i.test(f.body.slice(0, 2000)) && f.body !== page;
  const llmsOk = textFile(llms);
  checks.push(check("context", "llms", "/llms.txt file", llmsOk ? "pass" : "fail", llmsOk ? "Found: AI tools get a plain-text map of the site." : "Missing: there's no /llms.txt to guide AI tools."));
  const fullOk = textFile(llmsFull);
  checks.push(check("context", "llms-full", "/llms-full.txt file", fullOk ? "pass" : "warn", fullOk ? "Found." : "Missing (optional, but helps AI read services and pricing)."));
  const text = strip(page);
  checks.push(check("context", "no-js-text", "Readable without JavaScript", text.length >= 1500 ? "pass" : text.length >= 400 ? "warn" : "fail",
    `${text.length.toLocaleString("en-GB")} characters of text in the raw page${text.length < 400 ? ": most content needs JavaScript, which many AI crawlers don't run." : "."}`));
  const ratio = page.length ? text.length / page.length : 0;
  checks.push(check("context", "text-ratio", "Text-to-code ratio", ratio >= 0.1 ? "pass" : ratio >= 0.04 ? "warn" : "fail", `${Math.round(ratio * 100)}% of the page is readable text.`));
  const title = /<title[^>]*>([^<]{3,})<\/title>/i.test(page);
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(page) || /<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']description["']/i.test(page);
  checks.push(check("context", "meta", "Title and meta description", title && desc ? "pass" : title || desc ? "warn" : "fail", `${title ? "Title found" : "No title"}, ${desc ? "description found" : "no meta description"}.`));
  const h1 = (page.match(/<h1[\s>]/gi) ?? []).length, h2 = (page.match(/<h2[\s>]/gi) ?? []).length;
  checks.push(check("context", "headings", "Clear heading structure", h1 >= 1 && h2 >= 2 ? "pass" : h1 || h2 ? "warn" : "fail", `${h1} H1 and ${h2} H2 headings.`));

  // ---- Pillar 3: entity and schema
  const nodes = jsonLd(page);
  const all = nodes.flatMap(types);
  // Schema graphs often split one business across several nodes; read them together.
  const bizNodes = nodes.filter((n) => types(n).some((t) => BUSINESS.test(t)));
  const biz = bizNodes[0];
  const any = (f: (n: Node) => unknown) => bizNodes.some((n) => !!f(n));
  checks.push(check("entity", "jsonld", "Structured data (JSON-LD)", nodes.length ? "pass" : "fail", nodes.length ? `Found: ${[...new Set(all)].slice(0, 6).join(", ")}.` : "No JSON-LD: AI has to guess what the business is."));
  checks.push(check("entity", "business-type", "Business type declared", biz ? "pass" : "fail", biz ? `Declared as ${[...new Set(bizNodes.flatMap(types))].slice(0, 3).join(", ")}.` : "No LocalBusiness or Organization schema."));
  // Address and phone can sit on linked Place / PostalAddress nodes rather than the business itself.
  const hasAddress = any((n) => n.address || n.location) || nodes.some((n) => types(n).some((t) => t === "PostalAddress") || (types(n).includes("Place") && !!n.address));
  const hasPhone = any((n) => n.telephone) || nodes.some((n) => !!n.telephone);
  checks.push(check("entity", "nap", "Name, address and phone in schema", hasAddress && hasPhone ? "pass" : hasAddress || hasPhone ? "warn" : "fail",
    `${hasAddress ? "Address" : "No address"}, ${hasPhone ? "phone" : "no phone"} in the business schema.`));
  const geo = any((n) => n.geo || n.areaServed || n.serviceArea) || nodes.some((n) => !!n.geo || types(n).includes("GeoCoordinates"));
  checks.push(check("entity", "geo", "Location and service area", geo ? "pass" : "warn", geo ? "Coordinates or service area declared." : "No coordinates or service area: AI can't tie the business to a place."));
  const sameAs = new Set(bizNodes.flatMap((n) => ([] as unknown[]).concat(n.sameAs ?? []).map(String))).size;
  checks.push(check("entity", "sameas", "Linked profiles (sameAs)", sameAs >= 2 ? "pass" : sameAs === 1 ? "warn" : "fail", sameAs ? `${sameAs} linked profile${sameAs === 1 ? "" : "s"}.` : "No sameAs links to profiles such as Google, Yelp or Wikidata."));

  // ---- Pillar 4: answer readiness (AI answer visibility comes from the LLM audit)
  const faq = all.some((t) => /FAQPage|QAPage/.test(t));
  checks.push(check("conversational", "faq-schema", "FAQ schema", faq ? "pass" : "fail", faq ? "FAQPage schema found." : "No FAQ schema for AI to quote answers from."));
  const questions = (page.match(/<h[2-4][^>]*>[^<]{8,160}\?\s*<\/h[2-4]>/gi) ?? []).length;
  checks.push(check("conversational", "questions", "Question-and-answer content", questions >= 3 ? "pass" : questions ? "warn" : "fail", `${questions} question-style heading${questions === 1 ? "" : "s"} on the homepage.`));

  const pillars = (Object.keys(PILLAR_LABEL) as PillarKey[]).map((key) => {
    const cs = checks.filter((c) => c.pillar === key);
    const score = cs.length ? Math.round((cs.reduce((s, c) => s + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0) / cs.length) * 100) : 0;
    return { key, label: PILLAR_LABEL[key], score };
  });
  return {
    url: base, reachable: !!page,
    score: page ? Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length) : 0,
    pillars, checks, checked_at: new Date().toISOString(),
  };
}
