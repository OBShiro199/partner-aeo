// POST (no body) -> drains up to 25 queued emails from email_outbox through Resend.
// Called every minute by pg_cron and, for instant delivery, by the app after actions
// that queue email. It takes no input, so it's safe to call without credentials.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM ("Partner AEO <hello@mail.partneraeo.com>"),
//          EMAIL_REPLY_TO, APP_URL (https://partneraeo.com), EMAIL_FOOTER_ADDRESS.
import { admin, json } from "../_shared/common.ts";
import { latestPerPrompt, summarise } from "../_shared/digest.ts";
import * as T from "../_shared/email/templates.ts";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import { renderReportPdf } from "../_shared/report-pdf.ts";
import { RISK_LABEL, type ProspectReport } from "../_shared/audit.ts";

const MAX_ATTEMPTS = 4;
const EXPIRE_HOURS = 72;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" } });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ ok: true, skipped: "RESEND_API_KEY is not set; email stays queued" });

  const db = admin();
  const appUrl = (Deno.env.get("APP_URL") ?? "https://partneraeo.com").replace(/\/$/, "");
  const from = Deno.env.get("EMAIL_FROM") ?? "Partner AEO <hello@mail.partneraeo.com>";
  const replyTo = Deno.env.get("EMAIL_REPLY_TO") ?? undefined;
  const footerAddress = Deno.env.get("EMAIL_FOOTER_ADDRESS") ?? undefined;
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;

  // Old queued email is stale (a welcome three days late helps nobody).
  await db.from("email_outbox").update({ status: "skipped", last_error: "expired" })
    .eq("status", "pending").lt("created_at", new Date(Date.now() - EXPIRE_HOURS * 3600_000).toISOString());

  const { data: batch, error } = await db.rpc("claim_email_batch", { n: 25 });
  if (error) return json({ ok: false, error: error.message }, 500);

  const results: { id: number; status: string; error?: string }[] = [];
  for (const row of batch ?? []) {
    try {
      const [{ data: agency }, prefs] = await Promise.all([
        row.agency_id ? db.from("agencies").select("name").eq("id", row.agency_id).maybeSingle() : Promise.resolve({ data: null }),
        row.user_id ? db.from("email_preferences").select("*").eq("user_id", row.user_id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
      ]);
      const optional = row.kind === "weekly_digest" || row.kind === "visibility_drop";
      if (row.kind === "weekly_digest" && prefs && !prefs.weekly_digest) { await mark(db, row.id, "skipped", "unsubscribed"); continue; }
      if (row.kind === "visibility_drop" && prefs && !prefs.alerts) { await mark(db, row.id, "skipped", "unsubscribed"); continue; }

      const unsubQuery = optional && prefs ? `?t=${prefs.unsubscribe_token}&k=${row.kind === "weekly_digest" ? "weekly_digest" : "alerts"}` : null;
      const ctx: T.Ctx = {
        appUrl, footerAddress, agencyName: agency?.name ?? undefined,
        unsubscribeUrl: unsubQuery ? `${appUrl}/unsubscribe${unsubQuery}` : undefined,   // confirm page in the app
      };
      const d = row.data ?? {};
      let r: T.Rendered;
      let fromOverride: string | undefined;
      let replyOverride: string | undefined;
      let attachments: { filename: string; content: string }[] | undefined;
      switch (row.kind) {
        case "welcome": r = T.welcome(ctx, d); break;
        case "invite": r = T.invite(ctx, { ...d, to: row.to_email }); break;
        case "member_joined": r = T.memberJoined(ctx, d); break;
        case "visibility_drop": r = T.visibilityDrop(ctx, d); break;
        case "limit_reached": r = T.limitReached(ctx, d); break;
        case "trial_ending": r = T.trialEnding(ctx, d); break;
        case "new_lead": r = T.newLead(ctx, d); break;
        case "prospect_report": {
          const pr = await prospectEmail(db, d.audit_id, row.agency_id, d.first_name ?? null);
          if (!pr) { await mark(db, row.id, "skipped", "audit or widget missing"); continue; }
          ({ rendered: r, from: fromOverride, replyTo: replyOverride, attachments } = pr);
          break;
        }
        case "weekly_digest": {
          const digest = await buildDigest(db, row.agency_id);
          if (!digest.answers) { await mark(db, row.id, "skipped", "no answers this week"); continue; }
          r = T.weeklyDigest(ctx, digest);
          break;
        }
        default: await mark(db, row.id, "skipped", "unknown kind"); continue;
      }

      const headers: Record<string, string> = {};
      if (unsubQuery) {
        headers["List-Unsubscribe"] = `<${fnUrl}${unsubQuery}>`;   // one-click POST straight to the function
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `outbox-${row.id}` },
        body: JSON.stringify({
          from: fromOverride ?? from, to: [row.to_email], reply_to: replyOverride ?? replyTo, subject: r.subject, html: r.html, text: r.text, headers, attachments,
          tags: [{ name: "kind", value: row.kind }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: body.id ?? null, last_error: null }).eq("id", row.id);
        if (row.kind === "prospect_report" && d.lead_id) await db.from("leads").update({ report_sent_at: new Date().toISOString() }).eq("id", d.lead_id);
        results.push({ id: row.id, status: "sent" });
      } else {
        // 4xx other than rate limits won't fix themselves: stop retrying.
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
        await retryOrFail(db, row, `${res.status} ${body?.message ?? body?.name ?? ""}`.trim(), permanent);
        results.push({ id: row.id, status: "error", error: `${res.status}` });
      }
    } catch (e) {
      await retryOrFail(db, row, String(e).slice(0, 300), false);
      results.push({ id: row.id, status: "error", error: String(e).slice(0, 120) });
    }
  }
  return json({ ok: true, processed: results.length, results });
});

// deno-lint-ignore no-explicit-any
async function mark(db: any, id: number, status: string, note: string) {
  await db.from("email_outbox").update({ status, last_error: note }).eq("id", id);
}

// deno-lint-ignore no-explicit-any
async function retryOrFail(db: any, row: any, err: string, permanent: boolean) {
  if (permanent || row.attempts >= MAX_ATTEMPTS) {
    await db.from("email_outbox").update({ status: "failed", last_error: err }).eq("id", row.id);
  } else {
    const backoff = 2 ** row.attempts * 60_000; // 2, 4, 8 minutes
    await db.from("email_outbox").update({ status: "pending", last_error: err, send_after: new Date(Date.now() + backoff).toISOString() }).eq("id", row.id);
  }
}

// deno-lint-ignore no-explicit-any
async function buildDigest(db: any, agencyId: string): Promise<T.DigestData> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: clients }, { data: results }] = await Promise.all([
    db.from("clients").select("id, name, domain").eq("agency_id", agencyId).eq("status", "active"),
    db.from("scan_results").select("client_id, prompt_id, prompt_text, engine, status, mentioned, own_domain_cited, citations, created_at")
      .eq("agency_id", agencyId).gte("created_at", since).limit(20000),
  ]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const cur = latestPerPrompt((results ?? []).filter((r: { created_at: string }) => new Date(r.created_at).getTime() > weekAgo));
  const prev = latestPerPrompt((results ?? []).filter((r: { created_at: string }) => new Date(r.created_at).getTime() <= weekAgo));
  const all = summarise(cur), before = summarise(prev);
  const sourceCounts = new Map<string, number>();
  for (const r of cur) for (const d of new Set((r.citations ?? []).map((c: { domain: string }) => c.domain))) sourceCounts.set(d as string, (sourceCounts.get(d as string) ?? 0) + 1);
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return {
    period: `${fmt(weekAgo)} to ${fmt(Date.now())}`,
    visibility: all.visibility,
    delta: all.visibility != null && before.visibility != null ? all.visibility - before.visibility : null,
    mention_rate: all.mentionRate, citation_rate: all.citationRate, answers: all.answers,
    clients: (clients ?? []).map((c: { id: string; name: string; domain: string }) => {
      const a = summarise(cur.filter((r) => r.client_id === c.id));
      const b = summarise(prev.filter((r) => r.client_id === c.id));
      return { name: c.name, domain: c.domain, visibility: a.visibility, delta: a.visibility != null && b.visibility != null ? a.visibility - b.visibility : null };
    }).sort((x: { visibility: number | null }, y: { visibility: number | null }) => (y.visibility ?? -1) - (x.visibility ?? -1)),
    sources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([domain, count]) => ({ domain, count })),
  };
}

// The prospect's white-label email: agency branding, the 3-page PDF attached.
// deno-lint-ignore no-explicit-any
async function prospectEmail(db: any, auditId: string, agencyId: string, firstName: string | null) {
  const [{ data: a }, { data: w }, { data: ag }] = await Promise.all([
    db.from("audits").select("report, host").eq("id", auditId).maybeSingle(),
    db.from("widgets").select("*").eq("agency_id", agencyId).maybeSingle(),
    db.from("agencies").select("name, domain, website, favicon_url").eq("id", agencyId).maybeSingle(),
  ]);
  const report = a?.report as ProspectReport | undefined;
  if (!report?.prospect || !ag) return null;
  const logoUrl = w?.logo_url ?? ag.favicon_url ?? null;
  const logo = logoUrl ? await fetchImage(logoUrl) : null;
  const pdf = await renderReportPdf(PDFLib, report, {
    agency_name: ag.name, brand_color: w?.brand_color ?? "#5f86e0", logo: logo?.bytes, logo_type: logo?.type,
    contact_name: w?.contact_name, contact_email: w?.contact_email, contact_phone: w?.contact_phone,
    booking_url: w?.booking_url, website: ag.domain,
  });
  const invisible = report.prompts.filter((x) => !x.prospect_seen).length;
  const rendered = T.prospectReport({
    agency_name: ag.name, brand_color: w?.brand_color ?? "#5f86e0", logo_url: logoUrl, first_name: firstName,
    prospect_name: report.prospect.name, prospect_domain: report.prospect.domain, keyword: report.keyword,
    score: report.score, risk_label: RISK_LABEL[report.risk], competitor_name: report.competitor?.name ?? null,
    deflection_pct: report.deflection_rate == null ? null : Math.round(report.deflection_rate * 100),
    invisible, asked: report.prompts.length, contact_name: w?.contact_name, contact_email: w?.contact_email,
    contact_phone: w?.contact_phone, booking_url: w?.booking_url, host: a?.host ?? null,
  });
  // The sending address must be on a domain verified in Resend; the display name is the agency's.
  const address = Deno.env.get("REPORTS_FROM_ADDRESS") ?? "reports@mail.partneraeo.com";
  const name = (w?.sender_name || ag.name).replace(/["<>]/g, "");
  return {
    rendered,
    from: `${name} <${address}>`,
    replyTo: w?.contact_email ?? undefined,
    attachments: [{ filename: `AI-search-report-${report.prospect.domain}.pdf`, content: toBase64(pdf) }],
  };
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 2_000_000) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, type: "png" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: "jpg" };
    return null;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
