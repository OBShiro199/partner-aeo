// Helpers for the public widget endpoints (no sign-in: the widget's public key identifies the agency).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { HttpError } from "./common.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Keep working after the response is sent (Supabase background tasks).
export function background(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p.catch((e) => console.error(e)));
  else p.catch((e) => console.error(e));
}

export type Widget = {
  id: string; agency_id: string; public_key: string; enabled: boolean; allowed_hosts: string[]; default_region: string;
};

export async function widgetByKey(db: SupabaseClient, key: unknown): Promise<Widget> {
  const k = String(key ?? "");
  if (!/^pk_[a-f0-9]{32}$/.test(k)) throw new HttpError(404, "This widget isn't set up correctly.");
  const { data } = await db.from("widgets").select("id, agency_id, public_key, enabled, allowed_hosts, default_region").eq("public_key", k).maybeSingle();
  if (!data) throw new HttpError(404, "This widget isn't set up correctly.");
  if (!data.enabled) throw new HttpError(403, "This scanner is switched off right now.");
  return data as Widget;
}

export function checkHost(w: Widget, host: unknown): string | null {
  const h = String(host ?? "").toLowerCase().replace(/^www\./, "").slice(0, 200) || null;
  if (!w.allowed_hosts?.length) return h;
  const ok = h && w.allowed_hosts.some((a) => { const x = a.toLowerCase().replace(/^www\./, ""); return h === x || h.endsWith("." + x); });
  if (!ok) throw new HttpError(403, "This scanner isn't enabled on this website.");
  return h;
}

export async function ipHash(req: Request, salt: string) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

