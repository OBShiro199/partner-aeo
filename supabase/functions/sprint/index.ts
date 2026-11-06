// Signed in. The free trial sprint, and the free technical check.
// POST { agency_id, action: "start", client_url, niche, location, region } -> { client_id, lead_ids }
//   Finds local businesses on Google Maps, runs the technical audit on the agency's client and on
//   each candidate, and keeps the five weakest as prospects. Creates queued audits; the app then runs
//   their AI answer checks one by one through strategy-run (depth "lite"). Once per agency.
// POST { agency_id, action: "self", keyword? } -> { audit_id }   the agency's own audit, once
// POST { agency_id, action: "tech", domain }   -> TechAudit       a technical check only (free)
import { admin, handle, HttpError, json, logUsage, normaliseDomain, requireMember, requireUser } from "../_shared/common.ts";
import { mapsSearch, type MapsBusiness } from "../_shared/dataforseo.ts";
import { runTechAudit, type TechAudit } from "../_shared/tech-audit.ts";
import { LOCATION_CODES } from "../_shared/audit.ts";

const LEADS = 5;
const CANDIDATES = 12;
// Listings that are directories or platforms rather than the business's own site.
const NOT_A_BUSINESS_SITE = /(^|\.)(yelp|facebook|instagram|linkedin|google|angi|homeadvisor|thumbtack|bbb|yellowpages|nextdoor|houzz|porch|checkatrade|trustatrader|mybuilder|ratedpeople|bark|wix|squarespace|godaddysites|business\.site)\./;

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const rootOf = (d: string) => d.replace(/^www\./, "").toLowerCase();

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  const role = await requireMember(db, agencyId, user.id);
  const { data: agency } = await db.from("agencies").select("id, name, domain, regions, sprint, sprint_used_at").eq("id", agencyId).single();
  if (!agency) throw new HttpError(404, "Agency not found.");

  if (body.action === "tech") {
    const domain = normaliseDomain(String(body.domain ?? ""));
    return json(await runTechAudit(domain));
  }

  if (body.action === "self") {
    if (!agency.domain) throw new HttpError(400, "Add your agency's website in Settings first.");
    const { data: existing } = await db.from("audits").select("id").eq("agency_id", agencyId).eq("sprint_role", "self").maybeSingle();
    if (existing) return json({ audit_id: existing.id, existing: true });
    const location = String(agency.sprint?.location ?? "").trim();
    const keyword = String(body.keyword ?? "").trim().slice(0, 80) || `marketing agency${location ? ` in ${location}` : ""}`;
    const tech = await runTechAudit(agency.domain);
    const { data: a, error } = await db.from("audits").insert({
      agency_id: agencyId, source: "sprint", sprint_role: "self", depth: "lite", prospect_domain: agency.domain, prospect_name: agency.name,
      keyword, region: agency.regions?.find((r: string) => r !== "GLOBAL") ?? "GB", status: "queued", stage: "Waiting to start", tech, triggered_by: user.id,
    }).select("id").single();
    if (error) throw error;
    return json({ audit_id: a.id });
  }

  if (body.action !== "start") throw new HttpError(400, "Unknown action.");
  if (role === "member") throw new HttpError(403, "Ask an owner or admin to run the free audits.");
  if (agency.sprint_used_at) {
    const { data: rows } = await db.from("audits").select("id, sprint_role").eq("agency_id", agencyId).in("sprint_role", ["client", "lead"]);
    return json({ existing: true, client_id: rows?.find((r) => r.sprint_role === "client")?.id ?? null, lead_ids: (rows ?? []).filter((r) => r.sprint_role === "lead").map((r) => r.id) });
  }

  const client = normaliseDomain(String(body.client_url ?? ""));
  const niche = String(body.niche ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const location = String(body.location ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (niche.length < 3) throw new HttpError(400, "Add the niche you want leads in, like \"roofing contractors\".");
  if (location.length < 2) throw new HttpError(400, "Add a town or city, like \"Denver, CO\".");
  const region = /^[A-Z]{2}$/.test(String(body.region ?? "")) ? String(body.region) : agency.regions?.find((r: string) => r !== "GLOBAL") ?? "US";
  const keyword = `${niche} in ${location}`;

  // Claim the sprint first so a double click can't run (and pay for) it twice.
  const { data: claimed } = await db.from("agencies").update({ sprint: { client_url: client, niche, location, region }, sprint_used_at: new Date().toISOString() })
    .eq("id", agencyId).is("sprint_used_at", null).select("id");
  if (!claimed?.length) throw new HttpError(409, "Your free audits are already running.");

  try {
    const maps = await mapsSearch(keyword, LOCATION_CODES[region] ?? 2840, 20);
    await logUsage(db, { agency_id: agencyId, provider: "dataforseo", endpoint: "serp/google/maps/live/advanced", status: maps.ok ? "ok" : "error", http_status: maps.http_status, cost_usd: maps.cost_usd, meta: { keyword, ms: maps.ms, status_code: maps.status_code } });
    if (!maps.ok) throw new HttpError(502, `Couldn't search Google Maps right now (${maps.status_message}). Try again in a minute.`);

    const seen = new Set<string>([rootOf(client)]);
    const candidates: MapsBusiness[] = [];
    for (const b of maps.businesses) {
      if (!b.domain || b.directory || NOT_A_BUSINESS_SITE.test(`.${b.domain}`)) continue;
      const root = rootOf(b.domain);
      if (seen.has(root)) continue;
      seen.add(root);
      candidates.push({ ...b, domain: root });
      if (candidates.length >= CANDIDATES) break;
    }
    if (!candidates.length) throw new HttpError(404, `No local businesses with websites came up for "${keyword}". Try a broader niche or a bigger city.`);

    const [clientTech, ...techs] = await pool([client, ...candidates.map((c) => c.domain!)], 6, (d) => runTechAudit(d));
    // The market leader (top of Maps) is the competitor everyone is measured against.
    const leader = candidates[0];
    const scored = candidates.map((c, i) => ({ c, tech: techs[i] as TechAudit })).filter((x) => x.tech.reachable);
    const picks = scored.sort((a, b) => a.tech.score - b.tech.score || a.c.rank - b.c.rank).slice(0, LEADS);

    const rows = [
      {
        agency_id: agencyId, source: "sprint", sprint_role: "client", depth: "lite", prospect_domain: client, keyword, region,
        competitor_domain: leader.domain, competitor_name: leader.title, status: "queued", stage: "Waiting to start", tech: clientTech, business: {}, triggered_by: user.id,
      },
      ...picks.map(({ c, tech }) => {
        const rival = candidates.find((x) => x.domain !== c.domain)!;
        return {
          agency_id: agencyId, source: "sprint", sprint_role: "lead", depth: "lite", prospect_domain: c.domain, prospect_name: c.title, keyword, region,
          competitor_domain: rival.domain, competitor_name: rival.title, status: "queued", stage: "Waiting to start", tech, triggered_by: user.id,
          business: { name: c.title, phone: c.phone, address: c.address, rating: c.rating, votes: c.votes, category: c.category, maps_rank: c.rank, url: c.url, claimed: c.claimed },
        };
      }),
    ];
    const { data: inserted, error } = await db.from("audits").insert(rows).select("id, sprint_role");
    if (error) throw error;
    return json({
      client_id: inserted.find((r) => r.sprint_role === "client")!.id,
      lead_ids: inserted.filter((r) => r.sprint_role === "lead").map((r) => r.id),
      searched: maps.businesses.length, audited: candidates.length,
    });
  } catch (e) {
    // Nothing usable was created: give the sprint back so they can try again.
    await db.from("agencies").update({ sprint_used_at: null }).eq("id", agencyId);
    throw e;
  }
}));
