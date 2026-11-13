// Minimal Stripe client over fetch (no SDK): form-encoded requests, price lookup by
// lookup_key, and webhook signature checks. Keys come from Supabase secrets only:
//   STRIPE_SECRET_KEY (sk_test_… or sk_live_… / rk_…), STRIPE_WEBHOOK_SECRET (whsec_…).
import { HttpError } from "./common.ts";

export const PLANS = {
  starter: { name: "Starter", usd: 299 },
  growth: { name: "Growth", usd: 699 },
  scale: { name: "Scale", usd: 999 },
} as const;
export type PaidPlan = keyof typeof PLANS;
export const isPaidPlan = (p: unknown): p is PaidPlan => typeof p === "string" && p in PLANS;
export const lookupKey = (p: PaidPlan) => `partneraeo_${p}_monthly`;
export const planFromLookup = (k: string | null | undefined): PaidPlan | null => {
  const m = /^partneraeo_(starter|growth|scale)_monthly$/.exec(k ?? "");
  return m ? (m[1] as PaidPlan) : null;
};
export const TRIAL_DAYS = 7;

export const stripeConfigured = () => !!Deno.env.get("STRIPE_SECRET_KEY");

// Flatten { a: { b: 1 }, c: [x, y] } into a[b]=1&c[0]=x&c[1]=y.
function form(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === "object" ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x)));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new HttpError(503, "Payments aren't connected yet. Try again soon, or contact support.");
  const body = form(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "GET" ? undefined : body,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("stripe", path, res.status, data?.error?.message);
    throw new HttpError(502, `Payment provider error: ${data?.error?.message ?? res.status}`);
  }
  return data as T;
}

// The recurring price for a plan, created on first use so there's no manual Stripe setup.
const priceCache = new Map<PaidPlan, string>();
export async function priceFor(plan: PaidPlan): Promise<string> {
  const hit = priceCache.get(plan);
  if (hit) return hit;
  const found = await stripe<{ data: { id: string }[] }>("GET", "prices", { lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  let id = found.data[0]?.id;
  if (!id) {
    const product = await stripe<{ id: string }>("POST", "products", { name: `Partner AEO ${PLANS[plan].name}`, metadata: { plan } }, `product-${plan}-v1`);
    const price = await stripe<{ id: string }>("POST", "prices", {
      product: product.id, currency: "usd", unit_amount: PLANS[plan].usd * 100, recurring: { interval: "month" },
      lookup_key: lookupKey(plan), metadata: { plan },
    }, `price-${plan}-${PLANS[plan].usd}-v1`);
    id = price.id;
  }
  priceCache.set(plan, id);
  return id;
}

// Stripe-Signature: t=…,v1=…  HMAC-SHA256 of `${t}.${body}`; 5-minute tolerance.
export async function verifySignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${body}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && timingSafe(s, hex));
}
function timingSafe(a: string, b: string) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
