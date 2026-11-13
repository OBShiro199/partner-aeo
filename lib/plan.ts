// What a plan unlocks. The trial is the free sprint (1 client audit + 10 leads, PDFs included);
// the pitch deck, blueprint, sales scripts, widget, fixes and the Strategy Engine are paid.
import type { Agency } from "./types";

export type Feature = "deck" | "blueprint" | "sales_kit" | "widget" | "strategy" | "fixes" | "more_leads";

export const FEATURE_COPY: Record<Feature, { title: string; body: string }> = {
  deck: { title: "Unlock the pitch deck", body: "Convert this prospect with the editable closing deck: their score, share of voice, the questions they're invisible on and the sources to win, with a slide-by-slide script." },
  blueprint: { title: "Unlock the fulfilment blueprint", body: "All 25 buyer prompts with monthly AI search volume, and every page the engines cite: the plan your team delivers once the deal closes." },
  sales_kit: { title: "Unlock the sales scripts", body: "A cold email, a 2-minute phone talk track and a closing script, written by AI from this prospect's own results." },
  widget: { title: "Unlock the lead widget", body: "Embed the scanner on your website to capture prospects automatically, each with a ready-made pitch." },
  strategy: { title: "Unlock the Strategy Engine", body: "Run a full AI search analysis on any prospect before a sales call, whenever you need one." },
  fixes: { title: "Unlock Day-1 fixes", body: "Generated robots.txt rules, an /llms.txt file, schema markup and Q&A blocks, ready to paste onto a client's site." },
  more_leads: { title: "Find more leads", body: "Search any niche and location for businesses with weak AI visibility, each with a branded audit to send." },
};

export const isTrial = (a: Pick<Agency, "plan"> | null | undefined) => !a || a.plan === "trial";
export const canUse = (a: Pick<Agency, "plan"> | null | undefined, _f: Feature) => !isTrial(a);

// The v2 price list (Cliff's PRD, Nov 2026). Limits are enforced server-side from plan_allowances;
// this copy is for display only. Keep the two in step.
export type PaidPlan = "starter" | "growth" | "scale";
export const TRIAL_DAYS = 7;
export const PLAN_CATALOG: {
  id: PaidPlan; name: string; price: number; seats: number; clients: number; audits: number; leads: number; decks: number;
  prompts: number; widgetSites: number; agencyDomains: number; fixPacks: number; popular?: boolean; extras: string[];
}[] = [
  { id: "starter", name: "Starter", price: 299, seats: 1, clients: 5, audits: 25, leads: 25, decks: 10, prompts: 5, widgetSites: 2, agencyDomains: 1, fixPacks: 10,
    extras: ["Agency Day-1 fixes (1 domain)", "Direct-answer content at $6 each*"] },
  { id: "growth", name: "Growth", price: 699, seats: 5, clients: 30, audits: 100, leads: 100, decks: 50, prompts: 10, widgetSites: 10, agencyDomains: 1, fixPacks: 25, popular: true,
    extras: ["Direct-answer content, 1 per client a month*", "Competitor displacement, 1 per client a month*", "Forum Consensus Radar*", "Multi-form content, $249 syndication*"] },
  { id: "scale", name: "Scale", price: 999, seats: 10, clients: 100, audits: 500, leads: 500, decks: 200, prompts: 20, widgetSites: 25, agencyDomains: 3, fixPacks: 100,
    extras: ["Direct-answer content, 2 per client a month*", "Competitor displacement, 2 per client a month*", "Forum Consensus Radar*", "Multi-form content, $199 syndication*"] },
];
export const planLines = (p: (typeof PLAN_CATALOG)[number]) => [
  `${p.audits} branded PDF audits a month`,
  `${p.leads} new leads a month`,
  `${p.decks} pitch decks a month`,
  `${p.prompts} tracked prompts per client`,
  `Widget on ${p.widgetSites} sites`,
  `${p.fixPacks} client Day-1 fix packs a month`,
];
