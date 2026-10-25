"use client";
// Files the agency downloads from a lead or strategy run, built in the browser:
// the editable closing deck (.pptx, opens in PowerPoint, Keynote and Google Slides)
// and the same white-label PDF the prospect received.
import { DECK_SLIDES, ENGINE_LABEL, RISK_LABEL, type ProspectReport } from "@/supabase/functions/_shared/audit.ts";
import type { Agency, Audit, Widget } from "./types";

type Brand = { agency: Agency; widget: Widget | null };

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function logoBytes(url: string | null | undefined): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, type: "png" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: "jpg" };
  } catch { /* cross-origin logos fall back to an initial */ }
  return null;
}

const fileSafe = (s: string) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-|-$/g, "");

export async function downloadReportPdf(audit: Audit, { agency, widget }: Brand) {
  const [PDFLib, { renderReportPdf }] = await Promise.all([import("pdf-lib"), import("@/supabase/functions/_shared/report-pdf.ts")]);
  const logo = await logoBytes(widget?.logo_url ?? agency.favicon_url);
  const bytes = await renderReportPdf(PDFLib, audit.report as ProspectReport, {
    agency_name: agency.name, brand_color: widget?.brand_color ?? "#5f86e0", logo: logo?.bytes, logo_type: logo?.type,
    contact_name: widget?.contact_name, contact_email: widget?.contact_email, contact_phone: widget?.contact_phone,
    booking_url: widget?.booking_url, website: agency.domain,
  });
  save(new Blob([bytes as BlobPart], { type: "application/pdf" }), `AI-search-report-${fileSafe(audit.prospect_domain)}.pdf`);
}

export async function downloadDeck(audit: Audit, { agency, widget }: Brand) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const r = audit.report as ProspectReport;
  const notes = new Map((audit.assets.closing_script ?? []).map((s) => [s.slide, s.say]));
  const brand = (widget?.brand_color ?? "#5f86e0").replace("#", "");
  const comp = r.competitor?.name ?? "Competitor";
  const date = new Date(r.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const INK = "08090A", BODY = "3C4149", FAINT = "8A8F98", HAIR = "E6E6E9", RED = "C43C3C", GREEN = "1D7F34";
  const FONT = "Arial";

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.author = agency.name;
  pptx.company = agency.name;
  pptx.title = `AI Search Visibility: ${r.prospect.name}`;
  pptx.defineSlideMaster({
    title: "BRAND",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: brand } } },
      { text: { text: agency.name, options: { x: 0.6, y: 0.3, w: 6, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: INK } } },
      { line: { x: 0.6, y: 6.85, w: 12.13, h: 0, line: { color: HAIR, width: 0.75 } } },
      { text: { text: `${r.prospect.name} · AI Search Visibility · ${date}`, options: { x: 0.6, y: 6.9, w: 9, h: 0.35, fontFace: FONT, fontSize: 9, color: FAINT } } },
    ],
    slideNumber: { x: 12.3, y: 6.9, w: 0.5, h: 0.35, fontFace: FONT, fontSize: 9, color: FAINT },
  });
  const slide = (name: (typeof DECK_SLIDES)[number], title: string, sub?: string) => {
    const s = pptx.addSlide({ masterName: "BRAND" });
    s.addText(title, { x: 0.6, y: 0.95, w: 12.1, h: 0.8, fontFace: FONT, fontSize: 30, bold: true, color: INK });
    if (sub) s.addText(sub, { x: 0.6, y: 1.7, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 14, color: BODY });
    const say = notes.get(name);
    if (say) s.addNotes(say);
    return s;
  };

  // 1. Title
  {
    const s = pptx.addSlide({ masterName: "BRAND" });
    s.addText("AI Search Visibility", { x: 0.6, y: 2.2, w: 12, h: 0.5, fontFace: FONT, fontSize: 16, color: brand, bold: true });
    s.addText(r.prospect.name, { x: 0.6, y: 2.75, w: 12, h: 1.1, fontFace: FONT, fontSize: 48, bold: true, color: INK });
    s.addText(`How ChatGPT, Perplexity, Gemini and Claude answer questions about "${r.keyword}"`, { x: 0.6, y: 3.9, w: 11, h: 0.6, fontFace: FONT, fontSize: 16, color: BODY });
    s.addText(`Prepared by ${agency.name} · ${date}`, { x: 0.6, y: 4.7, w: 11, h: 0.4, fontFace: FONT, fontSize: 12, color: FAINT });
    if (notes.get("Title")) s.addNotes(notes.get("Title")!);
  }
  // 2. Context
  {
    const s = slide("Buyers now ask AI", "Buyers now ask AI for recommendations");
    s.addText([
      { text: "Buyers ask ChatGPT, Perplexity, Gemini and Claude which provider to choose.", options: { bullet: true, breakLine: true } },
      { text: "Each answer names a handful of brands. Everyone else is invisible for that buyer.", options: { bullet: true, breakLine: true } },
      { text: "The engines build answers from sources they trust: reviews, guides, directories and forums.", options: { bullet: true, breakLine: true } },
      { text: "Being in those sources is how a brand gets into the answer.", options: { bullet: true } },
    ], { x: 0.6, y: 2.0, w: 11.5, h: 3.5, fontFace: FONT, fontSize: 20, color: BODY, paraSpaceAfter: 14, valign: "top" });
  }
  // 3. Score
  {
    const s = slide("Your AI Search Score", "Your AI Search Score", `${r.answers} AI answers analysed`);
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.5, w: 5.8, h: 3.4, line: { color: HAIR, width: 1 }, fill: { color: "FFFFFF" } });
    s.addText("AI Search Score", { x: 0.9, y: 2.7, w: 5, h: 0.4, fontFace: FONT, fontSize: 13, color: FAINT });
    s.addText([{ text: String(r.score), options: { fontSize: 88, bold: true, color: INK } }, { text: " /100", options: { fontSize: 24, color: FAINT } }], { x: 0.9, y: 3.1, w: 5.2, h: 1.7, fontFace: FONT });
    s.addText(RISK_LABEL[r.risk].toUpperCase(), { x: 0.9, y: 5.0, w: 2.2, h: 0.45, fontFace: FONT, fontSize: 12, bold: true, color: r.risk === "visible" ? GREEN : RED, line: { color: r.risk === "visible" ? GREEN : RED, width: 1 }, align: "center" });
    s.addShape(pptx.ShapeType.rect, { x: 6.9, y: 2.5, w: 5.8, h: 3.4, line: { color: HAIR, width: 1 }, fill: { color: "FFFFFF" } });
    s.addText("AI Search Deflection Rate", { x: 7.2, y: 2.7, w: 5, h: 0.4, fontFace: FONT, fontSize: 13, color: FAINT });
    s.addText(r.deflection_rate == null ? "-" : `${Math.round(r.deflection_rate * 100)}%`, { x: 7.2, y: 3.1, w: 5.2, h: 1.7, fontFace: FONT, fontSize: 88, bold: true, color: r.deflection_rate && r.deflection_rate > 0.3 ? RED : INK });
    s.addText(r.competitor ? `of answers recommended ${comp} and didn't mention ${r.prospect.name}` : "Add a competitor to measure deflection", { x: 7.2, y: 4.9, w: 5.2, h: 0.7, fontFace: FONT, fontSize: 13, color: BODY });
  }
  // 4. Share of voice (an editable chart)
  {
    const s = slide("Share of voice", "Share of voice by engine", "Number of answers that named each brand");
    const labels = r.engines.map((e) => ENGINE_LABEL[e.engine] ?? e.engine);
    const data = [{ name: r.prospect.name, labels, values: r.engines.map((e) => e.prospect) }];
    if (r.competitor) data.push({ name: comp, labels, values: r.engines.map((e) => e.competitor) });
    s.addChart(pptx.ChartType.bar, data, {
      x: 0.6, y: 2.3, w: 12.1, h: 4.3, barDir: "bar", barGrouping: "clustered", chartColors: [brand, "8A8F98"],
      showLegend: true, legendPos: "b", legendFontFace: FONT, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
      catAxisLabelFontSize: 14, valAxisLabelFontSize: 11, valGridLine: { color: HAIR, size: 0.5 }, valAxisMinVal: 0,
      showValue: true, dataLabelFontSize: 11,
    });
  }
  // 5. Invisible prompts
  {
    const s = slide("Where you're invisible", "Questions where you're invisible", "Real buyer questions, asked live on each engine");
    const rows = r.prompts.slice(0, 5).map((p) => [
      { text: `"${p.text}"`, options: { fontSize: 14, color: INK } },
      { text: p.prospect_seen ? "Mentioned" : "Invisible", options: { fontSize: 12, bold: true, color: p.prospect_seen ? GREEN : RED } },
      { text: r.competitor ? (p.competitor_seen ? "Recommended" : "Not named") : "-", options: { fontSize: 12, color: BODY } },
    ]);
    s.addTable([
      [{ text: "Question", options: { bold: true, color: FAINT, fontSize: 11 } }, { text: r.prospect.name, options: { bold: true, color: FAINT, fontSize: 11 } }, { text: comp, options: { bold: true, color: FAINT, fontSize: 11 } }],
      ...rows,
    ], { x: 0.6, y: 2.3, w: 12.1, colW: [8.1, 2, 2], fontFace: FONT, border: { type: "solid", color: HAIR, pt: 0.75 }, rowH: 0.62, valign: "middle" });
  }
  // 6. Citation gaps
  {
    const s = slide("Where AI gets its answers", "Where AI gets its answers", "Pages the engines cited. Getting featured here is the fastest way in.");
    const rows = r.gaps.slice(0, 7).map((g) => [
      { text: g.domain, options: { fontSize: 14, bold: true, color: INK } },
      { text: g.title ?? "", options: { fontSize: 11, color: FAINT } },
      { text: r.competitor ? (g.with_competitor ? "Yes" : "No") : "-", options: { fontSize: 12, bold: true, color: g.with_competitor ? GREEN : RED, align: "center" as const } },
      { text: g.with_prospect ? "Yes" : "No", options: { fontSize: 12, bold: true, color: g.with_prospect ? GREEN : RED, align: "center" as const } },
    ]);
    s.addTable([
      [{ text: "Source", options: { bold: true, color: FAINT, fontSize: 11 } }, { text: "Page", options: { bold: true, color: FAINT, fontSize: 11 } }, { text: comp, options: { bold: true, color: FAINT, fontSize: 11, align: "center" as const } }, { text: r.prospect.name, options: { bold: true, color: FAINT, fontSize: 11, align: "center" as const } }],
      ...(rows.length ? rows : [[{ text: "No third-party sources were cited.", options: { fontSize: 12, color: FAINT } }, { text: "" }, { text: "" }, { text: "" }]]),
    ], { x: 0.6, y: 2.3, w: 12.1, colW: [3.2, 5.7, 1.6, 1.6], fontFace: FONT, border: { type: "solid", color: HAIR, pt: 0.75 }, rowH: 0.5, valign: "middle" });
  }
  // 7. The plan
  {
    const s = slide("The plan", "The plan", "Target the questions with the most AI search demand, then earn the citations");
    const top = (audit.hub.variations ?? []).slice().sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1)).slice(0, 6);
    s.addText("Priority questions", { x: 0.6, y: 2.3, w: 6, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: FAINT });
    s.addText(top.map((v) => ({ text: `${v.prompt}${v.volume ? `  (${v.volume.toLocaleString("en-GB")}/mo)` : ""}`, options: { bullet: true, breakLine: true } })), { x: 0.6, y: 2.7, w: 6.6, h: 3.8, fontFace: FONT, fontSize: 14, color: BODY, valign: "top", paraSpaceAfter: 8 });
    const targets = (audit.hub.citation_map ?? []).filter((c) => !c.with_prospect).slice(0, 6);
    s.addText("Sources to win", { x: 7.6, y: 2.3, w: 5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: FAINT });
    s.addText(targets.map((c) => ({ text: c.domain, options: { bullet: true, breakLine: true } })), { x: 7.6, y: 2.7, w: 5.1, h: 3.8, fontFace: FONT, fontSize: 14, color: BODY, valign: "top", paraSpaceAfter: 8 });
  }
  // 8. Next steps
  {
    const s = slide("Next steps", "Next steps");
    const contact = [widget?.contact_name, widget?.contact_email, widget?.contact_phone, widget?.booking_url].filter(Boolean).join("   ·   ");
    s.addText([
      { text: "30-day sprint on the priority questions", options: { bullet: { type: "number" }, breakLine: true } },
      { text: "Earn citations on the sources the engines trust", options: { bullet: { type: "number" }, breakLine: true } },
      { text: "Weekly tracking across ChatGPT, Perplexity, Gemini and Claude", options: { bullet: { type: "number" } } },
    ], { x: 0.6, y: 2.1, w: 12, h: 2.6, fontFace: FONT, fontSize: 22, color: BODY, paraSpaceAfter: 14, valign: "top" });
    if (contact) s.addText(contact, { x: 0.6, y: 5.3, w: 12, h: 0.6, fontFace: FONT, fontSize: 16, bold: true, color: brand });
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  save(blob, `${fileSafe(r.prospect.name)}-AI-search-deck.pptx`);
}
