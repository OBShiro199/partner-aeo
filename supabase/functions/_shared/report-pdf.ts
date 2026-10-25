// White-label 3-page prospect report (A4). Pure TypeScript: pdf-lib is passed in, so the
// email worker (Deno, npm:pdf-lib) and the dashboard (browser) render the same file.
// Branding is the agency's only; Partner AEO never appears.
import { ENGINE_LABEL, RISK_LABEL, type ProspectReport } from "./audit.ts";

export type Branding = {
  agency_name: string;
  brand_color: string;             // #rrggbb
  logo?: Uint8Array | null;        // PNG or JPEG bytes
  logo_type?: "png" | "jpg" | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  booking_url?: string | null;
  website?: string | null;
};

// deno-lint-ignore no-explicit-any
type PdfLib = any;

const W = 595.28, H = 841.89, M = 48;
const INK = [0.031, 0.035, 0.039], BODY = [0.235, 0.255, 0.286], MUTED = [0.384, 0.4, 0.427], FAINT = [0.541, 0.561, 0.596];
const HAIR = [0.902, 0.902, 0.914], SOFT = [0.965, 0.965, 0.969], RED = [0.769, 0.235, 0.235], GREEN = [0.114, 0.498, 0.204];

// Standard PDF fonts only cover WinAnsi; swap the usual suspects and drop the rest.
export function pdfSafe(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/[   ]/g, " ").replace(/\s+/g, " ")
    // deno-lint-ignore no-control-regex
    .replace(/[^\x20-\x7E£·éèàüöäçñ]/g, "").trim();
}

function hex(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  const n = parseInt(m ? m[1] : "5f86e0", 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export async function renderReportPdf(lib: PdfLib, r: ProspectReport, b: Branding): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = lib;
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Executive Diagnostic Assessment: ${r.prospect.name}`));
  doc.setAuthor(pdfSafe(b.agency_name));
  doc.setCreator(pdfSafe(b.agency_name));
  doc.setProducer(pdfSafe(b.agency_name));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hex(b.brand_color);
  const col = (c: number[]) => rgb(c[0], c[1], c[2]);
  const tint = (c: number[], t: number) => rgb(1 - (1 - c[0]) * t, 1 - (1 - c[1]) * t, 1 - (1 - c[2]) * t);

  let logo: { width: number; height: number } | null = null;
  if (b.logo?.length) {
    try { logo = b.logo_type === "jpg" ? await doc.embedJpg(b.logo) : await doc.embedPng(b.logo); } catch { logo = null; }
  }
  const date = new Date(r.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const comp = r.competitor?.name ?? "Competitor";

  // deno-lint-ignore no-explicit-any
  const text = (pg: any, s: string, x: number, y: number, o: { size?: number; f?: unknown; c?: number[] | ReturnType<typeof rgb> } = {}) =>
    pg.drawText(pdfSafe(s), { x, y, size: o.size ?? 10, font: o.f ?? font, color: Array.isArray(o.c) ? col(o.c) : o.c ?? col(BODY) });
  const wrap = (s: string, width: number, size: number, f = font): string[] => {
    const words = pdfSafe(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  // deno-lint-ignore no-explicit-any
  const para = (pg: any, s: string, x: number, y: number, width: number, o: { size?: number; f?: unknown; c?: number[]; lh?: number; max?: number } = {}) => {
    const size = o.size ?? 10, lh = o.lh ?? size * 1.5;
    const lines = wrap(s, width, size, (o.f as typeof font) ?? font).slice(0, o.max ?? 99);
    lines.forEach((l, i) => text(pg, l, x, y - i * lh, { size, f: o.f, c: o.c }));
    return y - lines.length * lh;
  };
  // deno-lint-ignore no-explicit-any
  const rule = (pg: any, y: number, x1 = M, x2 = W - M) => pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: col(HAIR) });
  // deno-lint-ignore no-explicit-any
  const pill = (pg: any, s: string, x: number, y: number, c: number[]) => {
    const w = bold.widthOfTextAtSize(pdfSafe(s), 7.5) + 14;
    pg.drawRectangle({ x, y: y - 4, width: w, height: 15, color: tint(c, 0.1), borderColor: tint(c, 0.45), borderWidth: 0.6 });
    text(pg, s, x + 7, y + 0.5, { size: 7.5, f: bold, c });
    return w;
  };
  // A tick or a cross drawn as lines, since the standard fonts have neither glyph.
  // deno-lint-ignore no-explicit-any
  const mark = (pg: any, ok: boolean, x: number, y: number) => {
    const c = col(ok ? GREEN : RED);
    pg.drawCircle({ x: x + 6, y: y + 3, size: 7.5, color: tint(ok ? GREEN : RED, 0.1), borderColor: tint(ok ? GREEN : RED, 0.5), borderWidth: 0.6 });
    if (ok) {
      pg.drawLine({ start: { x: x + 2.6, y: y + 3.2 }, end: { x: x + 5, y: y + 0.6 }, thickness: 1.4, color: c });
      pg.drawLine({ start: { x: x + 5, y: y + 0.6 }, end: { x: x + 9.6, y: y + 6 }, thickness: 1.4, color: c });
    } else {
      pg.drawLine({ start: { x: x + 3, y: y }, end: { x: x + 9, y: y + 6 }, thickness: 1.4, color: c });
      pg.drawLine({ start: { x: x + 3, y: y + 6 }, end: { x: x + 9, y: y }, thickness: 1.4, color: c });
    }
  };

  const pages = [doc.addPage([W, H]), doc.addPage([W, H]), doc.addPage([W, H])];
  pages.forEach((pg, i) => {
    pg.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: col(brand) });
    // Header: agency logo + name, report label on the right.
    let x = M;
    if (logo) {
      const s = 22 / Math.max(logo.width, logo.height);
      pg.drawImage(logo, { x, y: H - 52, width: logo.width * s, height: logo.height * s });
      x += logo.width * s + 8;
    } else {
      pg.drawCircle({ x: x + 11, y: H - 41, size: 11, color: tint(brand, 0.14), borderColor: col(brand), borderWidth: 0.8 });
      text(pg, b.agency_name.charAt(0).toUpperCase(), x + 7.4, H - 45, { size: 11, f: bold, c: brand });
      x += 30;
    }
    text(pg, b.agency_name, x, H - 45, { size: 11, f: bold, c: INK });
    const label = "Executive Diagnostic Assessment";
    text(pg, label, W - M - font.widthOfTextAtSize(label, 9), H - 44, { size: 9, c: FAINT });
    rule(pg, H - 64);
    // Footer
    rule(pg, 46);
    text(pg, `Prepared by ${b.agency_name} for ${r.prospect.name} · ${date}`, M, 30, { size: 8, c: FAINT });
    const pn = `Page ${i + 1} of 3`;
    text(pg, pn, W - M - font.widthOfTextAtSize(pn, 8), 30, { size: 8, c: FAINT });
  });

  // ---------------- Page 1: score + share of voice ----------------
  {
    const pg = pages[0];
    let y = H - 104;
    text(pg, `${r.prospect.name} (${r.prospect.domain})`, M, y, { size: 10, c: MUTED });
    y -= 30;
    text(pg, "How visible are you in AI search?", M, y, { size: 22, f: bold, c: INK });
    y -= 22;
    y = para(pg, `We asked ChatGPT, Perplexity, Gemini and Claude the questions buyers ask about "${r.keyword}" and recorded who each answer recommended.`, M, y, W - 2 * M, { size: 10.5, c: BODY });

    // Score card
    y -= 22;
    const cardH = 132;
    pg.drawRectangle({ x: M, y: y - cardH, width: W - 2 * M, height: cardH, borderColor: col(HAIR), borderWidth: 0.8 });
    const riskC = r.risk === "visible" ? GREEN : r.risk === "at_risk" ? [0.78, 0.5, 0.06] : RED;
    // Gauge: 0-100 as a bar of 20 segments.
    const gx = M + 24, gy = y - 40;
    text(pg, "AI Search Score", gx, gy + 6, { size: 9, c: FAINT });
    text(pg, String(r.score), gx, gy - 44, { size: 48, f: bold, c: INK });
    text(pg, "/100", gx + bold.widthOfTextAtSize(String(r.score), 48) + 4, gy - 44, { size: 14, c: FAINT });
    pill(pg, RISK_LABEL[r.risk].toUpperCase(), gx, gy - 72, riskC);
    for (let i = 0; i < 20; i++) {
      pg.drawRectangle({ x: gx + 118 + i * 5.5, y: gy - 40, width: 3.5, height: 30, color: i < Math.round(r.score / 5) ? col(brand) : col(SOFT) });
    }
    const sx = M + (W - 2 * M) / 2 + 30;
    pg.drawLine({ start: { x: sx - 16, y: y - 16 }, end: { x: sx - 16, y: y - cardH + 16 }, thickness: 0.6, color: col(HAIR) });
    text(pg, "AI Search Deflection Rate", sx, gy + 6, { size: 9, c: FAINT });
    const dr = r.deflection_rate == null ? "-" : `${Math.round(r.deflection_rate * 100)}%`;
    text(pg, dr, sx, gy - 44, { size: 48, f: bold, c: r.deflection_rate && r.deflection_rate > 0.3 ? RED : INK });
    para(pg, r.competitor ? `of answers recommended ${comp} and did not mention you.` : "Add a competitor to measure deflection.", sx, gy - 62, W - M - sx - 16, { size: 9, c: MUTED, max: 3 });
    y -= cardH + 34;

    // Share of voice grid
    text(pg, "Share of voice by engine", M, y, { size: 13, f: bold, c: INK });
    y -= 16;
    para(pg, "How many answers named each brand. Each engine was asked the same buyer questions.", M, y, W - 2 * M, { size: 9.5, c: MUTED });
    y -= 26;
    const c1 = M, c2 = M + 120, c3 = M + 120 + (W - 2 * M - 120) / 2;
    const half = (W - 2 * M - 120) / 2 - 20;
    text(pg, "ENGINE", c1, y, { size: 7.5, f: bold, c: FAINT });
    text(pg, pdfSafe(r.prospect.name).toUpperCase().slice(0, 28), c2, y, { size: 7.5, f: bold, c: FAINT });
    text(pg, pdfSafe(comp).toUpperCase().slice(0, 28), c3, y, { size: 7.5, f: bold, c: FAINT });
    y -= 10;
    rule(pg, y);
    for (const e of ["chatgpt", "perplexity", "gemini", "claude"]) {
      const row = r.engines.find((x) => x.engine === e);
      y -= 34;
      text(pg, ENGINE_LABEL[e], c1, y + 4, { size: 10.5, f: bold, c: INK });
      if (!row) {
        text(pg, "Not tested", c2, y + 4, { size: 9.5, c: FAINT });
      } else {
        const bar = (x: number, n: number, color: number[]) => {
          pg.drawRectangle({ x, y: y + 2, width: half - 70, height: 8, color: col(SOFT) });
          if (n) pg.drawRectangle({ x, y: y + 2, width: Math.max(3, (half - 70) * n / row.answers), height: 8, color: col(color) });
          text(pg, `${n} of ${row.answers}`, x + half - 62, y + 2.5, { size: 9.5, c: n ? INK : FAINT });
        };
        bar(c2, row.prospect, brand);
        if (r.competitor) bar(c3, row.competitor, MUTED); else text(pg, "-", c3, y + 4, { size: 9.5, c: FAINT });
      }
      y -= 10;
      rule(pg, y);
    }
    y -= 26;
    para(pg, `${r.answers} AI answers analysed on ${date}. AI answers change often; this is a snapshot.`, M, y, W - 2 * M, { size: 8.5, c: FAINT });
  }

  // ---------------- Page 2: invisible prompts ----------------
  {
    const pg = pages[1];
    let y = H - 110;
    text(pg, "Questions your buyers ask AI", M, y, { size: 22, f: bold, c: INK });
    y -= 22;
    y = para(pg, "These are real questions buyers type into AI assistants. Each one was asked live; the flags show who the answers named.", M, y, W - 2 * M, { size: 10.5 });
    y -= 18;
    const list = r.prompts.slice(0, 5);
    for (const p of list) {
      const lines = wrap(`"${p.text}"`, W - 2 * M - 40, 12.5, bold).slice(0, 3);
      const h = 54 + lines.length * 17 + (p.prospect_seen ? 0 : 16);
      pg.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, borderColor: col(HAIR), borderWidth: 0.8 });
      pg.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: col(p.prospect_seen ? GREEN : RED) });
      let ly = y - 26;
      lines.forEach((l) => { text(pg, l, M + 20, ly, { size: 12.5, f: bold, c: INK }); ly -= 17; });
      let px = M + 20;
      px += pill(pg, p.prospect_seen ? "YOU WERE MENTIONED" : "YOU ARE INVISIBLE", px, ly - 6, p.prospect_seen ? GREEN : RED) + 8;
      if (r.competitor) px += pill(pg, p.competitor_seen ? `${pdfSafe(comp).toUpperCase().slice(0, 24)} WAS RECOMMENDED` : `${pdfSafe(comp).toUpperCase().slice(0, 24)} NOT NAMED`, px, ly - 6, p.competitor_seen ? MUTED : FAINT) + 8;
      text(pg, `Asked on ${p.engines.map((e) => ENGINE_LABEL[e] ?? e).join(", ")}`, px + 4, ly - 4, { size: 8.5, c: FAINT });
      if (!p.prospect_seen) text(pg, `Result: ${r.prospect.name} was not named in ${p.engines.length === 1 ? "this model's answer" : `any of the ${p.engines.length} models' answers`}.`, M + 20, ly - 24, { size: 9, f: bold, c: RED });
      y -= h + 12;
    }
    const invisible = list.filter((p) => !p.prospect_seen).length;
    y -= 8;
    pg.drawRectangle({ x: M, y: y - 58, width: W - 2 * M, height: 58, color: tint(brand, 0.06), borderColor: tint(brand, 0.3), borderWidth: 0.6 });
    para(pg, invisible
      ? `You were missing from ${invisible} of ${list.length} questions. Every one of those answers sends a ready-to-buy customer somewhere else.`
      : `You appeared in every question we tested. The next step is moving up the list and getting cited as a source.`, M + 16, y - 22, W - 2 * M - 32, { size: 10.5, f: bold, c: INK });
  }

  // ---------------- Page 3: citation gaps + next step ----------------
  {
    const pg = pages[2];
    let y = H - 110;
    text(pg, "Where AI gets its answers", M, y, { size: 22, f: bold, c: INK });
    y -= 22;
    y = para(pg, "AI engines cite these pages when they answer your buyers' questions. Getting featured on them is the fastest way into the answers.", M, y, W - 2 * M, { size: 10.5 });
    y -= 24;
    const cA = M, cB = W - M - 150, cC = W - M - 60;
    text(pg, "SOURCE THE ENGINES CITED", cA, y, { size: 7.5, f: bold, c: FAINT });
    text(pg, pdfSafe(comp).toUpperCase().slice(0, 14), cB, y, { size: 7.5, f: bold, c: FAINT });
    text(pg, "YOU", cC, y, { size: 7.5, f: bold, c: FAINT });
    y -= 10;
    rule(pg, y);
    const gaps = r.gaps.slice(0, 8);
    if (!gaps.length) { y -= 26; text(pg, "The engines didn't cite any third-party pages for these questions.", cA, y, { size: 10, c: MUTED }); y -= 12; }
    for (const g of gaps) {
      y -= 30;
      text(pg, g.domain, cA, y + 6, { size: 10.5, f: bold, c: INK });
      if (g.title) text(pg, wrap(g.title, cB - cA - 20, 8.5)[0] ?? "", cA, y - 6, { size: 8.5, c: FAINT });
      if (r.competitor) mark(pg, g.with_competitor, cB + 4, y); else text(pg, "-", cB + 6, y + 1, { c: FAINT });
      mark(pg, g.with_prospect, cC + 2, y);
      y -= 12;
      rule(pg, y);
    }
    y -= 14;
    para(pg, `A tick means an answer citing that page also named the brand. ${r.competitor ? `${comp} appears alongside these sources; you don't yet.` : ""}`, M, y, W - 2 * M, { size: 8.5, c: FAINT });

    // Next step box, pinned above the footer.
    const bh = 128, by = 70;
    pg.drawRectangle({ x: M, y: by, width: W - 2 * M, height: bh, borderColor: col(brand), borderWidth: 1 });
    text(pg, "Your next step", M + 20, by + bh - 30, { size: 14, f: bold, c: INK });
    para(pg, `${b.agency_name} can get ${r.prospect.name} into these answers: we earn citations on the pages above and make your site easy for AI engines to quote.`, M + 20, by + bh - 50, W - 2 * M - 40, { size: 10, max: 2 });
    const cy = by + 30;
    const parts = [b.contact_name, b.contact_email, b.contact_phone, b.booking_url ?? b.website].filter(Boolean) as string[];
    text(pg, parts.join("   ·   "), M + 20, cy, { size: 10, f: bold, c: brand });
  }

  return await doc.save();
}
