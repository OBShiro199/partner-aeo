// The AI Prompt Intent Strategy Engine. One pipeline, two depths:
//   lite  (widget): 5 buyer prompts, a small answer matrix across 4 engines, score + report.
//   full  (lead / back office): adds 25 prompt variations with AI search volume, a citation
//         map, sentiment, optional LLM Mentions, and an AI-written sales kit.
// Every paid call is checked against platform_limits.dfs_total_max_spend_usd first.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { fetchSite, htmlToText, logUsage } from "./common.ts";
import { extractDfs } from "./analyse.ts";
import { aiKeywordVolume, llmMentions, llmResponse, type DfsEngine } from "./dataforseo.ts";
import { haikuJson } from "./haiku.ts";
import {
  buildReport, cellFromAnswer, citationMap, DECK_SLIDES, ENGINE_LABEL, LOCATION_CODES, nameFromTitle,
  type Brand, type Cell, type Hub, type MentionSummary, type SalesKit, type Sentiment, type Variation,
} from "./audit.ts";

// Conservative per-call estimates from measured runs, used to reserve budget up front.
const EST: Record<string, number> = { chatgpt: 0.035, gemini: 0.04, claude: 0.03, perplexity: 0.008, keywords: 0.015, mentions: 0.13 };
const INTENTS = ["best_for", "problem", "comparison", "local", "other"] as const;

type Audit = {
  id: string; agency_id: string; depth: "lite" | "full"; prospect_domain: string; prospect_name: string | null;
  keyword: string; competitor_domain: string | null; competitor_name: string | null; region: string;
  report: Record<string, unknown>; hub: Hub; assets: SalesKit; cost_usd: number;
};

export async function dfsRemaining(db: SupabaseClient): Promise<number> {
  const [{ data: limits }, { data: used }] = await Promise.all([
    db.from("platform_limits").select("dfs_total_max_spend_usd").single(),
    db.from("api_usage").select("cost_usd").eq("provider", "dataforseo").eq("status", "ok"),
  ]);
  const spent = (used ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  return Number(limits?.dfs_total_max_spend_usd ?? 0) - spent;
}

async function siteBrand(domain: string, given: string | null) {
  const html = await fetchSite(domain);
  const title = html?.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
  const og = html?.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{1,80})["']/i)?.[1] ?? null;
  return {
    brand: { domain, name: given?.trim() || og?.trim() || nameFromTitle(title, domain) } as Brand,
    text: html ? htmlToText(html, 4000) : "",
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const VARIATION_SCHEMA = {
  type: "object", additionalProperties: false, required: ["category", "items"],
  properties: {
    category: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["prompt", "keyword", "intent"],
        properties: { prompt: { type: "string" }, keyword: { type: "string" }, intent: { type: "string", enum: [...INTENTS] } },
      },
    },
  },
};

function templatePrompts(keyword: string, region: string, competitor: Brand | null, n: number): Variation[] {
  const where = region && region !== "GLOBAL" ? ` in ${region === "GB" ? "the UK" : region}` : "";
  const k = keyword.trim();
  const list: [string, string, string][] = [
    [`What is the best ${k}${where}?`, k, "best_for"],
    [`Who are the top rated ${k} providers${where}?`, `top ${k}`, "local"],
    [`Which ${k} would you recommend for a small business?`, `${k} for small business`, "best_for"],
    [`How do I choose a good ${k}?`, `how to choose ${k}`, "problem"],
    [`What does ${k} usually cost${where}?`, `${k} cost`, "problem"],
  ];
  if (competitor) list.push([`What are the best alternatives to ${competitor.name}?`, `${competitor.name} alternatives`, "comparison"]);
  list.push([`Is it worth paying for ${k}?`, `is ${k} worth it`, "problem"], [`${k} reviews${where}`, `${k} reviews`, "other"]);
  return list.slice(0, n).map(([prompt, kw, intent]) => ({ prompt, keyword: kw.toLowerCase(), intent, volume: null, trend: null }));
}

async function writePrompts(db: SupabaseClient, a: Audit, prospect: Brand, competitor: Brand | null, siteText: string, n: number, avoid: string[]) {
  const r = await haikuJson<{ category: string; items: { prompt: string; keyword: string; intent: string }[] }>(db, a.agency_id, {
    tag: "strategy_prompts",
    schema: VARIATION_SCHEMA,
    maxTokens: 4000,
    system: "You map how real buyers phrase questions to AI assistants (ChatGPT, Perplexity, Gemini, Claude) when they are choosing a product or service.",
    user:
      `Seed category keyword: ${a.keyword}\nMarket: ${a.region}\nBusiness being audited: ${prospect.name} (${prospect.domain})\n` +
      (competitor ? `Main competitor: ${competitor.name} (${competitor.domain})\n` : "") +
      `<website>\n${siteText || "(site could not be read)"}\n</website>\n` +
      (avoid.length ? `Already written (do not repeat): ${avoid.join(" | ")}\n` : "") +
      `\nWrite ${n} distinct conversational prompts a potential customer would type into an AI assistant for this category. ` +
      `Write them the way a person types, not as marketing copy. Never name ${prospect.name}. ` +
      `Mix intents: best_for, problem, comparison (you may name the competitor), local (mention the market). ` +
      `For each, give the 1-4 word search keyword it maps to (lowercase, like "${a.keyword.toLowerCase()} cost"). ` +
      `Order them from highest to lowest buying intent. Also return the category in 2-5 words.`,
  });
  const lower = prospect.name.toLowerCase();
  const seen = new Set(avoid.map((s) => s.toLowerCase()));
  const items = (r?.data.items ?? [])
    .map((i) => ({ prompt: String(i.prompt).trim().slice(0, 300), keyword: String(i.keyword).trim().toLowerCase().slice(0, 80), intent: INTENTS.includes(i.intent as never) ? i.intent : "other", volume: null, trend: null }))
    .filter((i) => i.prompt.length > 5 && !i.prompt.toLowerCase().includes(lower) && !seen.has(i.prompt.toLowerCase()) && seen.add(i.prompt.toLowerCase()))
    .slice(0, n) as Variation[];
  return { items: items.length ? items : templatePrompts(a.keyword, a.region, competitor, n), category: r?.data.category ?? null, source: items.length ? "haiku" : "template" };
}

// ---------------------------------------------------------------------------
// Answer matrix
// ---------------------------------------------------------------------------
function plan(prompts: string[], depth: "lite" | "full", have: Set<string>): { prompt: string; engine: DfsEngine }[] {
  const out: { prompt: string; engine: DfsEngine }[] = [];
  const add = (prompt: string | undefined, engine: DfsEngine) => { if (prompt && !have.has(`${prompt}|${engine}`)) out.push({ prompt, engine }); };
  // Headline prompt on every engine; the next ones on Perplexity, which costs a fraction.
  for (const e of ["perplexity", "chatgpt", "gemini", "claude"] as DfsEngine[]) add(prompts[0], e);
  for (const p of prompts.slice(1, 5)) add(p, "perplexity");
  if (depth === "full") {
    for (const e of ["chatgpt", "gemini", "claude"] as DfsEngine[]) add(prompts[1], e);
    for (const p of prompts.slice(5, 10)) add(p, "perplexity");
  }
  return out;
}

async function askMatrix(db: SupabaseClient, a: Audit, jobs: { prompt: string; engine: DfsEngine }[], prospect: Brand, competitor: Brand | null, notes: string[]) {
  let budget = await dfsRemaining(db);
  const run: typeof jobs = [];
  const skipped: string[] = [];
  for (const j of jobs) {
    if (budget >= EST[j.engine]) { run.push(j); budget -= EST[j.engine]; } else skipped.push(ENGINE_LABEL[j.engine]);
  }
  if (skipped.length) notes.push(`Spend cap reached: skipped ${skipped.length} answer${skipped.length === 1 ? "" : "s"} (${[...new Set(skipped)].join(", ")}).`);

  return await Promise.all(run.map(async (j): Promise<Cell> => {
    try {
      const r = await llmResponse(j.engine, j.prompt);
      await logUsage(db, {
        agency_id: a.agency_id, provider: "dataforseo", endpoint: `${j.engine}/llm_responses/live`, status: r.ok ? "ok" : "error",
        http_status: r.http_status, cost_usd: r.cost_usd, meta: { audit_id: a.id, model: r.model, status_code: r.status_code, ms: r.ms },
      });
      if (!r.ok) return { prompt: j.prompt, engine: j.engine, ok: false, text: "", citations: [], prospect: false, prospect_cited: false, position: null, competitor: false, competitor_cited: false, cost_usd: 0, error: `${r.status_code}: ${r.status_message}` };
      const { text, citations } = extractDfs(r.result);
      return cellFromAnswer(j.prompt, j.engine, text, citations, prospect, competitor, r.cost_usd);
    } catch (e) {
      return { prompt: j.prompt, engine: j.engine, ok: false, text: "", citations: [], prospect: false, prospect_cited: false, position: null, competitor: false, competitor_cited: false, cost_usd: 0, error: String(e).slice(0, 200) };
    }
  }));
}

// ---------------------------------------------------------------------------
// Sentiment and sales kit
// ---------------------------------------------------------------------------
const SENTIMENT = {
  type: "object", additionalProperties: false, required: ["sentiment", "adjectives", "summary"],
  properties: {
    sentiment: { type: "string", enum: ["positive", "neutral", "negative", "absent"] },
    adjectives: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

async function sentiment(db: SupabaseClient, a: Audit, cells: Cell[], prospect: Brand, competitor: Brand | null, mentionText: string) {
  const absent: Sentiment = { sentiment: "absent", adjectives: [], summary: "Not mentioned in any answer we collected." };
  const named = (b: "prospect" | "competitor") => cells.filter((c) => c.ok && c[b]);
  if (!named("prospect").length && !named("competitor").length && !mentionText) return { prospect: absent, competitor: competitor ? absent : null };
  const answers = cells.filter((c) => c.ok && (c.prospect || c.competitor)).slice(0, 8)
    .map((c) => `[${ENGINE_LABEL[c.engine]}] Q: ${c.prompt}\n${c.text.slice(0, 1800)}`).join("\n---\n");
  const r = await haikuJson<{ prospect: Sentiment; competitor: Sentiment }>(db, a.agency_id, {
    tag: "strategy_sentiment", maxTokens: 1200,
    schema: { type: "object", additionalProperties: false, required: ["prospect", "competitor"], properties: { prospect: SENTIMENT, competitor: SENTIMENT } },
    system: "You analyse how AI assistants describe brands. Report only what the answers actually say.",
    user:
      `Brand A: ${prospect.name} (${prospect.domain})\nBrand B: ${competitor?.name ?? "none"} (${competitor?.domain ?? "-"})\n` +
      `<answers>\n${answers || "(none)"}\n</answers>\n` + (mentionText ? `<mentions>\n${mentionText.slice(0, 6000)}\n</mentions>\n` : "") +
      `\nFor each brand: overall sentiment of how the answers describe it ("absent" if never mentioned), up to 6 adjectives or short phrases the answers use about it (verbatim where possible), and a one-sentence summary.`,
  });
  return {
    prospect: named("prospect").length || mentionText ? r?.data.prospect ?? absent : absent,
    competitor: competitor ? r?.data.competitor ?? absent : null,
  };
}

type KitInput = {
  agency: { name: string; contact_name: string | null; booking_url: string | null };
  prospect: Brand; competitor: Brand | null; keyword: string; score: number; deflection: number | null;
  engines: { engine: string; answers: number; prospect: number; competitor: number }[];
  invisible: string[]; gaps: string[]; top_volume: { keyword: string; volume: number }[];
};

function templateKit(k: KitInput): SalesKit {
  const pct = k.deflection != null ? `${Math.round(k.deflection * 100)}%` : null;
  const comp = k.competitor?.name ?? "your competitors";
  const sender = k.agency.contact_name ?? k.agency.name;
  return {
    source: "template",
    cold_email: {
      subject: `${k.prospect.name} in AI search: ${k.score}/100`,
      body:
        `Hi,\n\nWe asked ChatGPT, Perplexity, Gemini and Claude the questions your buyers ask about ${k.keyword}. ` +
        `${k.prospect.name} scored ${k.score}/100 for AI visibility` + (pct ? `, and ${pct} of answers recommended ${comp} without mentioning you.` : ".") +
        `\n\nOne example: "${k.invisible[0] ?? k.keyword}". ${k.prospect.name} wasn't named.\n\n` +
        `We fix this by getting you onto the pages these engines cite. Worth a 15-minute look at the full report?\n\n${sender}\n${k.agency.name}`,
    },
    talk_track:
      `Opener: "I'm ${sender} from ${k.agency.name}. I'm calling because we ran an AI search audit on ${k.prospect.name} and found something you'll want to see."\n\n` +
      `Problem: "Buyers now ask AI assistants for recommendations. When they ask about ${k.keyword}, ${k.prospect.name} scored ${k.score} out of 100` + (pct ? `, and ${comp} was recommended instead in ${pct} of answers.` : ".") + `"\n\n` +
      `Proof: "For example, on '${k.invisible[0] ?? k.keyword}', the answer didn't mention you. The engines leaned on sources like ${k.gaps.slice(0, 2).join(" and ") || "review and directory sites"}."\n\n` +
      `Offer: "We get you cited on those sources and tune your site so AI engines can quote you. We track it weekly across four engines."\n\n` +
      `Ask: "Can I walk you through the full report this week? It takes 15 minutes."`,
    closing_script: DECK_SLIDES.map((slide) => ({ slide, say: ({
      "Title": `Thanks for the time. This is what AI assistants say when your buyers ask about ${k.keyword}.`,
      "Buyers now ask AI": "More buyers now ask ChatGPT, Perplexity, Gemini and Claude for a recommendation before they ever search Google. Being named in that answer is the new page one.",
      "Your AI Search Score": `${k.prospect.name} scored ${k.score} out of 100. That measures how often you're named and cited across the answers we collected.`,
      "Share of voice": pct ? `${comp} was recommended without you in ${pct} of answers. Here's the split by engine.` : "Here's how often each engine named you.",
      "Where you're invisible": `These are the questions where you weren't named, starting with "${k.invisible[0] ?? k.keyword}".`,
      "Where AI gets its answers": `The engines lean on a small set of sources: ${k.gaps.slice(0, 3).join(", ") || "reviews, directories and guides"}. Getting onto those is how you get into the answer.`,
      "The plan": "We target the prompts with the most demand, earn citations on the sources above, and tune your pages so the engines can quote you. We track it weekly.",
      "Next steps": "If this makes sense, we start with a 30-day sprint on the top prompts and report back on the same four engines.",
    } as Record<string, string>)[slide] ?? "" })),
  };
}

async function salesKit(db: SupabaseClient, a: Audit, k: KitInput): Promise<SalesKit> {
  const r = await haikuJson<Omit<SalesKit, "source">>(db, a.agency_id, {
    tag: "strategy_sales_kit", maxTokens: 3500,
    schema: {
      type: "object", additionalProperties: false, required: ["cold_email", "talk_track", "closing_script"],
      properties: {
        cold_email: { type: "object", additionalProperties: false, required: ["subject", "body"], properties: { subject: { type: "string" }, body: { type: "string" } } },
        talk_track: { type: "string" },
        closing_script: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["slide", "say"], properties: { slide: { type: "string", enum: [...DECK_SLIDES] }, say: { type: "string" } } },
        },
      },
    },
    system:
      "You write sales material for a marketing agency selling AI search visibility (AEO) services. " +
      "Use only the numbers and facts in the data. Never invent statistics, clients or results. Plain, confident British English, no hype words, no em dashes.",
    user:
      `Data (JSON):\n${JSON.stringify(k)}\n\nWrite:\n` +
      `1. cold_email: subject (under 60 characters) and a body under 130 words from ${k.agency.contact_name ?? "the agency"} at ${k.agency.name} to the owner of ${k.prospect.name}. Lead with one specific finding, end with a soft ask for 15 minutes. Sign off with the sender name and agency.\n` +
      `2. talk_track: a 2-minute phone script (about 280 words) with labelled parts: Opener, Problem, Proof, Offer, Objection (one likely objection and the answer), Ask.\n` +
      `3. closing_script: one entry per slide, in this order: ${DECK_SLIDES.join(", ")}. "say" is 2-4 sentences the presenter says on that slide, citing the data.`,
  });
  if (!r) return templateKit(k);
  const bySlide = new Map((r.data.closing_script ?? []).map((s) => [s.slide, s.say]));
  return { ...r.data, closing_script: DECK_SLIDES.map((slide) => ({ slide, say: bySlide.get(slide) ?? "" })), source: "haiku" };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
export async function runAudit(db: SupabaseClient, auditId: string, depth: "lite" | "full"): Promise<void> {
  const { data: a } = await db.from("audits").select("*").eq("id", auditId).single<Audit>();
  if (!a) return;
  const stage = (s: string) => db.from("audits").update({ status: "running", stage: s }).eq("id", auditId);
  const hub: Hub = { ...(a.hub ?? {}) };
  const notes: string[] = [...(hub.notes ?? [])];
  const loc = LOCATION_CODES[a.region] ?? 2840;

  try {
    await db.from("audits").update({ status: "running", stage: `Reading ${a.prospect_domain}`, started_at: new Date().toISOString(), error: null }).eq("id", auditId);
    const [p, c] = await Promise.all([
      siteBrand(a.prospect_domain, a.prospect_name),
      a.competitor_domain ? siteBrand(a.competitor_domain, a.competitor_name) : Promise.resolve(null),
    ]);
    const prospect = p.brand;
    const competitor = c?.brand ?? null;

    // Prompts: 5 for lite. Full keeps the lite prompts first and adds up to 25 in total.
    await stage("Writing buyer prompts");
    let variations = hub.variations ?? [];
    if (variations.length < 5) {
      const w = await writePrompts(db, a, prospect, competitor, p.text, 5, []);
      variations = w.items; hub.category = w.category;
    }
    if (depth === "full" && variations.length < 25) {
      const w = await writePrompts(db, a, prospect, competitor, p.text, 25 - variations.length, variations.map((v) => v.prompt));
      variations = [...variations, ...w.items].slice(0, 25);
      hub.category ??= w.category;
    }
    const prompts = variations.map((v) => v.prompt);

    await stage("Asking ChatGPT, Perplexity, Gemini and Claude");
    const prior = (hub.cells ?? []).filter((x) => x.ok);
    const jobs = plan(prompts, depth, new Set(prior.map((x) => `${x.prompt}|${x.engine}`)));
    const fresh = await askMatrix(db, a, jobs, prospect, competitor, notes);
    const cells = [...prior, ...fresh];
    const failed = fresh.filter((x) => !x.ok);
    if (failed.length) notes.push(`${failed.length} engine call${failed.length === 1 ? "" : "s"} failed and ${failed.length === 1 ? "was" : "were"} left out.`);
    let cost = fresh.reduce((s, x) => s + x.cost_usd, 0);

    if (!cells.some((x) => x.ok)) throw new Error(jobs.length && !fresh.length ? "budget" : "no_answers");

    if (depth === "full") {
      await stage("Measuring AI search demand");
      if ((await dfsRemaining(db)) >= EST.keywords) {
        const kws = [...new Set([a.keyword.toLowerCase(), ...variations.map((v) => v.keyword)].filter(Boolean))];
        const v = await aiKeywordVolume(kws, loc);
        await logUsage(db, { agency_id: a.agency_id, provider: "dataforseo", endpoint: "ai_keyword_data/keywords_search_volume/live", status: v.ok ? "ok" : "error", http_status: v.http_status, cost_usd: v.cost_usd, meta: { audit_id: a.id, status_code: v.status_code, keywords: kws.length } });
        cost += v.cost_usd;
        if (v.ok) variations = variations.map((x) => ({ ...x, volume: v.volumes.get(x.keyword)?.volume ?? null, trend: v.volumes.get(x.keyword)?.trend ?? null }));
        else notes.push(`AI search volume unavailable (${v.status_message}).`);
      } else notes.push("Spend cap reached: AI search volume skipped.");

      // LLM Mentions is the priciest call, so it's off until platform_limits.mentions_enabled.
      const { data: limits } = await db.from("platform_limits").select("mentions_enabled").single();
      let mentionText = "";
      hub.mentions = null;
      if (limits?.mentions_enabled) {
        await stage("Reading brand mentions");
        const targets = [prospect, competitor].filter(Boolean) as Brand[];
        const out: (MentionSummary | null)[] = [];
        for (const b of targets) {
          if ((await dfsRemaining(db)) < EST.mentions) { out.push(null); notes.push(`Spend cap reached: LLM Mentions skipped for ${b.name}.`); continue; }
          const m = await llmMentions(b.domain, loc, 10);
          await logUsage(db, { agency_id: a.agency_id, provider: "dataforseo", endpoint: "llm_mentions/search/live", status: m.ok ? "ok" : "error", http_status: m.http_status, cost_usd: m.cost_usd, meta: { audit_id: a.id, status_code: m.status_code, domain: b.domain } });
          cost += m.cost_usd;
          out.push(m.ok ? { total: m.total, questions: m.items.map(({ question, platform, volume }) => ({ question, platform, volume })) } : null);
          if (m.ok) mentionText += m.items.map((i) => `[${b.name}] Q: ${i.question}\n${i.answer.slice(0, 800)}`).join("\n---\n") + "\n";
        }
        hub.mentions = { prospect: out[0] ?? null, competitor: competitor ? out[1] ?? null : null };
      }

      await stage("Reading how AI describes each brand");
      const s = await sentiment(db, a, cells, prospect, competitor, mentionText);
      hub.sentiment = { ...s, source: mentionText ? "llm_mentions" : "answers" };
    }

    const report = buildReport(cells, { prospect, competitor, keyword: a.keyword, region: a.region, prompts: prompts.slice(0, depth === "full" ? 10 : 5) });
    hub.cells = cells;
    hub.variations = variations;
    hub.citation_map = citationMap(cells.filter((x) => x.ok), prospect, competitor).slice(0, 25);
    hub.notes = [...new Set(notes)];

    let assets = a.assets ?? {};
    if (depth === "full") {
      await stage("Writing the sales kit");
      const { data: ag } = await db.from("agencies").select("name").eq("id", a.agency_id).single();
      const { data: w } = await db.from("widgets").select("contact_name, booking_url").eq("agency_id", a.agency_id).maybeSingle();
      assets = await salesKit(db, a, {
        agency: { name: ag?.name ?? "our agency", contact_name: w?.contact_name ?? null, booking_url: w?.booking_url ?? null },
        prospect, competitor, keyword: a.keyword, score: report.score, deflection: report.deflection_rate, engines: report.engines,
        invisible: report.prompts.filter((x) => !x.prospect_seen).map((x) => x.text).slice(0, 5),
        gaps: report.gaps.map((g) => g.domain).slice(0, 6),
        top_volume: variations.filter((v) => v.volume).sort((x, y) => (y.volume ?? 0) - (x.volume ?? 0)).slice(0, 5).map((v) => ({ keyword: v.keyword, volume: v.volume! })),
      });
    }

    await db.from("audits").update({
      status: "complete", stage: null, depth, prospect_name: prospect.name, competitor_name: competitor?.name ?? null,
      score: report.score, risk: report.risk, deflection_rate: report.deflection_rate,
      report, hub, assets, cost_usd: Number(a.cost_usd ?? 0) + cost, error: null, finished_at: new Date().toISOString(),
    }).eq("id", auditId);
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    const friendly = msg === "budget"
      ? "The scanner has reached its spending cap. Raise platform_limits.dfs_total_max_spend_usd to run more."
      : msg === "no_answers" ? "None of the AI engines answered. Try again in a few minutes." : "The audit failed. Try again in a few minutes.";
    console.error("audit failed", auditId, msg);
    // A lite audit with nothing to show gives the credit back. A failed upgrade keeps the lite report.
    const hadReport = Object.keys(a.report ?? {}).length > 0;
    if (!hadReport) await db.rpc("refund_credit", { p_audit: auditId });
    await db.from("audits").update(hadReport
      ? { status: "complete", stage: null, hub: { ...hub, notes: [...notes, `Full analysis failed: ${friendly}`] } }
      : { status: "failed", stage: null, error: friendly, finished_at: new Date().toISOString() }).eq("id", auditId);
  }
}

export async function cacheKey(...parts: (string | null | undefined)[]) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.map((p) => (p ?? "").toLowerCase().trim()).join("|")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
