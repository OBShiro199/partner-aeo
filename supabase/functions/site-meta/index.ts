// POST { url } -> { domain, name, description, favicon_url }
// Reads a website's title, og:site_name and icons so the agency and its clients
// show up with their real name and favicon. Free: no paid API involved.
import { admin, fetchSite, handle, json, normaliseDomain, requireUser } from "../_shared/common.ts";

function pick(html: string, re: RegExp) {
  return html.match(re)?.[1]?.trim() ?? null;
}

function decode(s: string | null) {
  return s
    ?.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? null;
}

Deno.serve(handle(async (req) => {
  const db = admin();
  await requireUser(req, db);
  const { url } = await req.json();
  const domain = normaliseDomain(String(url ?? ""));
  const html = await fetchSite(domain);

  const siteName = decode(html && pick(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i));
  const title = decode(html && pick(html, /<title[^>]*>([^<]+)<\/title>/i));
  const description = decode(
    html && (pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ??
      pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)),
  );
  const icon = html && pick(html, /<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)/i);

  // Title like "Acme | CRM for plumbers" -> "Acme"
  const fromTitle = title?.split(/\s[|\-–—:·]\s/)[0]?.trim();
  const fallback = domain.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  const name = (siteName ?? fromTitle ?? fallback).slice(0, 80);

  let favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  if (icon) {
    try { favicon_url = new URL(icon, `https://${domain}/`).toString(); } catch { /* keep fallback */ }
  }

  return json({ domain, name, description, favicon_url, reachable: !!html });
}));
