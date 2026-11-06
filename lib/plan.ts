// What a plan unlocks. The trial is the free sprint (1 client audit + 5 leads, PDFs included);
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
