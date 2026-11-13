// Public (verify_jwt off): Stripe calls this. Every request is checked against STRIPE_WEBHOOK_SECRET.
// Endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, customer.subscription.created / updated / deleted.
import { admin, json } from "../_shared/common.ts";
import { stripe, verifySignature } from "../_shared/stripe.ts";
import { syncSubscription, type StripeSub } from "../_shared/billing-sync.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook secret not set." }, 503);
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("stripe-signature"), secret))) return json({ error: "Bad signature." }, 400);

  const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const db = admin();
  // Once per event: Stripe retries on any non-2xx.
  const { error: dup } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dup) return json({ ok: true, duplicate: true });

  try {
    let agencyId: string | null = null;
    const o = event.data.object;
    if (event.type === "checkout.session.completed" && o.mode === "subscription" && typeof o.subscription === "string") {
      agencyId = await syncSubscription(db, await stripe<StripeSub>("GET", `subscriptions/${o.subscription}`));
    } else if (event.type.startsWith("customer.subscription.")) {
      agencyId = await syncSubscription(db, o as unknown as StripeSub);
    }
    if (agencyId) await db.from("stripe_events").update({ agency_id: agencyId }).eq("id", event.id);
    return json({ ok: true });
  } catch (e) {
    console.error("webhook", event.type, e);
    await db.from("stripe_events").delete().eq("id", event.id); // let Stripe retry
    return json({ error: "Processing failed." }, 500);
  }
});
