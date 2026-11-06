// Renders the white-label prospect PDF with sample numbers: npx tsx scripts/report-preview.ts
import * as PDFLib from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";
import { renderReportPdf } from "../supabase/functions/_shared/report-pdf.ts";
import type { ProspectReport } from "../supabase/functions/_shared/audit.ts";

const r: ProspectReport = {
  prospect: { name: "Daygent", domain: "usedaygent.com" },
  competitor: { name: "Moneypenny", domain: "moneypenny.com" },
  keyword: "ai receptionist", region: "GB", score: 12, risk: "high", deflection_rate: 0.5, answers: 8,
  engines: [
    { engine: "chatgpt", answers: 1, prospect: 0, competitor: 1 },
    { engine: "perplexity", answers: 5, prospect: 1, competitor: 3 },
    { engine: "gemini", answers: 1, prospect: 0, competitor: 1 },
  ],
  prompts: [
    { text: "What is the best AI receptionist for small businesses in the UK?", engines: ["chatgpt", "perplexity", "gemini"], prospect_seen: false, competitor_seen: true },
    { text: "How do I stop missing calls when I'm on a job?", engines: ["perplexity"], prospect_seen: false, competitor_seen: false },
    { text: "Moneypenny alternatives that are cheaper", engines: ["perplexity"], prospect_seen: true, competitor_seen: true },
    { text: "Is an AI phone answering service worth it for a plumber?", engines: ["perplexity"], prospect_seen: false, competitor_seen: true },
  ],
  gaps: [
    { domain: "techradar.com", url: "https://techradar.com/x", title: "Best virtual receptionist services of 2026", count: 3, with_competitor: true, with_prospect: false },
    { domain: "reddit.com", url: "https://reddit.com/x", title: "r/smallbusiness: AI receptionist recommendations?", count: 2, with_competitor: true, with_prospect: false },
    { domain: "trustpilot.com", url: "https://trustpilot.com/x", count: 1, with_competitor: false, with_prospect: false },
  ],
  generated_at: new Date().toISOString(),
};
const out = process.argv[2] ?? "emails/preview/report.pdf";
mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
renderReportPdf(PDFLib, r, {
  agency_name: "Northlight Digital", brand_color: "#2f7d6d", contact_name: "Sam Patel",
  contact_email: "sam@northlight.co", contact_phone: "+44 20 7946 0000", booking_url: "northlight.co/call",
}, {
  url: "https://usedaygent.com", reachable: true, score: 41, checked_at: new Date().toISOString(),
  pillars: [{ key: "access", label: "AI crawler access", score: 75 }, { key: "context", label: "Context for AI", score: 42 }, { key: "entity", label: "Entity and schema", score: 20 }, { key: "conversational", label: "Answer readiness", score: 25 }],
  checks: [
    { id: "a", pillar: "access", label: "GPTBot can load the homepage", status: "pass", detail: "Answered 200 in 0.6s." },
    { id: "b", pillar: "access", label: "ClaudeBot can load the homepage", status: "fail", detail: "A firewall challenge (such as Cloudflare's) stopped the request." },
    { id: "c", pillar: "context", label: "/llms.txt file", status: "fail", detail: "Missing: there's no /llms.txt to guide AI tools." },
    { id: "d", pillar: "context", label: "Readable without JavaScript", status: "warn", detail: "812 characters of text in the raw page." },
    { id: "e", pillar: "entity", label: "Business type declared", status: "fail", detail: "No LocalBusiness or Organization schema." },
    { id: "f", pillar: "conversational", label: "FAQ schema", status: "fail", detail: "No FAQ schema for AI to quote answers from." },
  ],
}).then((b) => { writeFileSync(out, b); console.log("wrote", out, b.length); });
