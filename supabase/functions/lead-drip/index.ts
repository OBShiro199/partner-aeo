// Signed in (owner/admin). The weekly lead drip: new local businesses for the agency's niche,
// with emails, phones and socials, each checked for AI readiness, weakest first, then emailed.
// POST { agency_id, action: "run", niche?, location?, count?, email? } -> { batch_id, prospects, emailed_to, cost_usd }
//   Search: Treg -> AnyAPI "Google Maps Contacts" (Maps results + contact details scraped from each site,
//   about $0.005 a business). Secret: TREG_API_KEY. Counts against plan_allowances.leads per month.
import { admin, handle, HttpError, json, logUsage, requireMember, requireUser } from "../_shared/common.ts";
import { runTechAudit, type TechAudit } from "../_shared/tech-audit.ts";

const SKIP = /(^|\.)(yelp|facebook|instagram|linkedin|google|angi|homeadvisor|thumbtack|bbb|yellowpages|nextdoor|houzz|porch|checkatrade|trustatrader|mybuilder|ratedpeople|bark|wix|squarespace|godaddysites|business\.site)\./;
const rootOf = (u: string) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Place = {
  name?: string; website?: string; phone?: string; phones?: string[]; emails?: string[]; address?: string; category?: string;
  rating?: number; reviewCount?: number; url?: string; facebooks?: string[]; instagrams?: string[]; linkedIns?: string[];
};

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
  return out;
}

// Treg relays the catalogued call; the AnyAPI answer is { output: { data: { items } }, costUsd }.
async function searchPlaces(query: string, location: string, limit: number) {
  const token = Deno.env.get("TREG_API_KEY");
  if (!token) throw new HttpError(503, "Lead search isn't connected yet (TREG_API_KEY is not set).");
  const started = Date.now();
  const res = await fetch("https://treg.to/call/anyapi.maps.contacts", {
    method: "POST",
    headers: { "X-Treg-Token": token, "Content-Type": "application/json", "X-Treg-Route-Max-Cost": "0.25" },
    body: JSON.stringify({ query, location, limit, website: "withWebsite", language: "en" }),
    signal: AbortSignal.timeout(110_000),
  });
  const body = await res.json().catch(() => ({}));
  const items = [body?.output?.data?.items, body?.data?.items, body?.result?.output?.data?.items, body?.result?.data?.items].find(Array.isArray) as Place[] | undefined;
  const micro = body?._treg?.charged_micro ?? body?.result?._treg?.charged_micro;
  const cost = Number(body?.costUsd ?? body?.result?.costUsd ?? (micro != null ? micro / 1e6 : 0)) || 0;
  return { ok: res.ok && !!items, status: res.status, items: items ?? [], cost, ms: Date.now() - started, error: res.ok ? null : String(body?.error ?? body?.detail ?? body?.message ?? res.statusText).slice(0, 200) };
}

function emailHtml(o: { agency: string; niche: string; location: string; appUrl: string; rows: Record<string, unknown>[] }) {
  const tone = (n: number) => (n >= 70 ? "#1D7F34" : n >= 40 ? "#B26B00" : "#C43C3C");
  const rows = o.rows.map((p) => {
    const t = p.tech as TechAudit;
    const issue = t?.checks?.find((c) => c.status === "fail");
    const emails = (p.emails as string[]).slice(0, 2).join("<br>") || "<span style=\"color:#8A8F98\">none found</span>";
    return `<tr>
      <td style="padding:10px 8px;border-top:1px solid #E6E6E9;vertical-align:top"><b>${esc(p.name)}</b><br><a href="${esc(p.website)}" style="color:#3B63C4">${esc(p.domain)}</a>${p.rating ? `<br><span style="color:#8A8F98">${esc(p.rating)}★ (${esc(p.reviews)})</span>` : ""}</td>
      <td style="padding:10px 8px;border-top:1px solid #E6E6E9;vertical-align:top">${emails}${p.phone ? `<br>${esc(p.phone)}` : ""}</td>
      <td style="padding:10px 8px;border-top:1px solid #E6E6E9;vertical-align:top;white-space:nowrap"><b style="color:${tone(Number(p.tech_score))}">${esc(p.tech_score)}/100</b></td>
      <td style="padding:10px 8px;border-top:1px solid #E6E6E9;vertical-align:top;color:#3C4149">${esc(issue ? `${issue.label}: ${issue.detail}` : "No blocking issues")}</td>
    </tr>`;
  }).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#F7F7F8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#08090A;font-size:14px;line-height:1.45">
  <div style="max-width:760px;margin:0 auto;padding:28px 16px">
    <p style="margin:0 0 4px;color:#3B63C4;font-weight:600">Partner AEO · Weekly leads</p>
    <h1 style="font-size:22px;margin:0 0 6px">${o.rows.length} new ${esc(o.niche)} leads in ${esc(o.location)}</h1>
    <p style="margin:0 0 18px;color:#3C4149">Found on Google Maps for ${esc(o.agency)}, then checked for AI readiness. The weakest sites are first: they have the most to gain.</p>
    <table cellspacing="0" cellpadding="0" style="width:100%;background:#fff;border:1px solid #E6E6E9;border-radius:8px;border-collapse:separate">
      <tr style="text-align:left;color:#8A8F98;font-size:12px"><th style="padding:10px 8px">Business</th><th style="padding:10px 8px">Contact</th><th style="padding:10px 8px">AI readiness</th><th style="padding:10px 8px">Biggest gap</th></tr>
      ${rows}
    </table>
    <p style="margin:18px 0 0"><a href="${esc(o.appUrl)}/leads" style="display:inline-block;background:#08090A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Open your leads</a></p>
    <p style="margin:16px 0 0;color:#8A8F98;font-size:12px">Contact details come from each business's own website and Google listing. Check before you reach out.</p>
  </div></body></html>`;
  const text = `${o.rows.length} new ${o.niche} leads in ${o.location}\n\n` + o.rows.map((p) => `${p.name} (${p.domain}) · ${(p.emails as string[])[0] ?? "no email"} · ${p.phone ?? ""} · readiness ${p.tech_score}/100`).join("\n");
  return { html, text };
}

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  const role = await requireMember(db, agencyId, user.id);
  if (body.action !== "run") throw new HttpError(400, "Unknown action.");
  if (role === "member") throw new HttpError(403, "Ask an owner or admin to run the lead search.");

  const { data: agency } = await db.from("agencies").select("id, name, plan, sprint").eq("id", agencyId).single();
  if (!agency) throw new HttpError(404, "Agency not found.");
  const niche = String(body.niche ?? agency.sprint?.niche ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const location = String(body.location ?? agency.sprint?.location ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (niche.length < 3 || location.length < 2) throw new HttpError(400, "Add a niche and a town or city.");

  // Monthly allowance: drip prospects plus free-audit leads created this month.
  const { data: al } = await db.from("plan_allowances").select("leads").eq("plan", agency.plan).maybeSingle();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [{ count: dripped }, { count: sprinted }] = await Promise.all([
    db.from("prospects").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).gte("created_at", monthStart),
    db.from("audits").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).eq("sprint_role", "lead").gte("created_at", monthStart),
  ]);
  const left = (al?.leads ?? 0) - (dripped ?? 0) - (sprinted ?? 0);
  const want = Math.min(Math.max(1, Number(body.count) || 10), 10, left);
  if (want <= 0) throw new HttpError(402, `You've used this month's ${al?.leads ?? 0} leads. Upgrade for more.`);

  const found = await searchPlaces(niche, location, 20);
  await logUsage(db, { agency_id: agencyId, provider: "treg", endpoint: "anyapi.maps.contacts", status: found.ok ? "ok" : "error", http_status: found.status, cost_usd: found.cost, meta: { niche, location, items: found.items.length, ms: found.ms, error: found.error } });
  if (!found.ok) throw new HttpError(502, `Lead search failed (${found.status}${found.error ? `: ${found.error}` : ""}).`);

  // Skip directories, the agency's own clients and anyone already sent.
  const [{ data: seenP }, { data: seenA }, { data: clients }] = await Promise.all([
    db.from("prospects").select("domain").eq("agency_id", agencyId),
    db.from("audits").select("prospect_domain").eq("agency_id", agencyId),
    db.from("clients").select("domain").eq("agency_id", agencyId),
  ]);
  const seen = new Set<string>([...(seenP ?? []).map((r) => r.domain), ...(seenA ?? []).map((r) => r.prospect_domain), ...(clients ?? []).map((r) => r.domain)].filter(Boolean));
  const fresh: (Place & { domain: string })[] = [];
  for (const p of found.items) {
    const domain = p.website ? rootOf(p.website) : "";
    if (!domain || SKIP.test(`.${domain}`) || seen.has(domain)) continue;
    seen.add(domain);
    fresh.push({ ...p, domain });
  }
  if (!fresh.length) return json({ batch_id: null, prospects: [], found: found.items.length, message: "No new businesses this time. Try a wider area or another niche." });

  const techs = await pool(fresh, 6, (p) => runTechAudit(p.domain));
  const ranked = fresh.map((p, i) => ({ p, t: techs[i] })).filter((x) => x.t.reachable)
    .sort((a, b) => a.t.score - b.t.score || Number(b.p.emails?.length ?? 0) - Number(a.p.emails?.length ?? 0)).slice(0, want);

  const batchId = crypto.randomUUID();
  const rows = ranked.map(({ p, t }) => ({
    agency_id: agencyId, batch_id: batchId, source: "treg", niche, location,
    name: (p.name ?? p.domain).slice(0, 200), domain: p.domain, website: p.website ?? `https://${p.domain}`,
    phone: p.phone ?? p.phones?.[0] ?? null, emails: [...new Set((p.emails ?? []).map((e) => e.toLowerCase()))].slice(0, 5),
    socials: { facebook: p.facebooks ?? [], instagram: p.instagrams ?? [], linkedin: p.linkedIns ?? [] },
    address: p.address ?? null, category: p.category ?? null, rating: p.rating ?? null, reviews: p.reviewCount ?? null, maps_url: p.url ?? null,
    tech: t, tech_score: t.score,
  }));
  const { error } = await db.from("prospects").insert(rows);
  if (error) throw error;

  // Email the batch: to the agency's contact address on its branding, else the person who ran it.
  let emailedTo: string | null = null;
  if (body.email !== false && rows.length) {
    const { data: w } = await db.from("widgets").select("contact_email").eq("agency_id", agencyId).maybeSingle();
    const to = w?.contact_email || user.email;
    const key = Deno.env.get("RESEND_API_KEY");
    if (to && key) {
      const appUrl = (Deno.env.get("APP_URL") ?? "https://partneraeo.com").replace(/\/$/, "");
      const { html, text } = emailHtml({ agency: agency.name, niche, location, appUrl, rows });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: Deno.env.get("EMAIL_FROM") ?? "Partner AEO <hello@mail.partneraeo.com>", to: [to], subject: `${rows.length} new ${niche} leads in ${location}`, html, text }),
      });
      if (r.ok) emailedTo = to; else console.error("lead email failed", r.status, await r.text());
    }
  }

  return json({
    batch_id: batchId, found: found.items.length, checked: fresh.length, cost_usd: found.cost, emailed_to: emailedTo, left: left - rows.length,
    prospects: rows.map(({ tech: _t, ...r }) => r),
  });
}));
