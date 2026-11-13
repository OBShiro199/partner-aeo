// Signed in. Stripe billing for an agency.
// POST { agency_id, action: "status" }                         -> billing state + whether Stripe is connected
// POST { agency_id, action: "checkout", plan, return_path? }   -> { url } Stripe Checkout (7-day trial, card up front)
//      If they already have a subscription: switches the plan in place (and ends a trial now = "upgrade now").
// POST { agency_id, action: "portal", return_path? }           -> { url } Stripe customer portal (card, invoices, cancel)
import { admin, handle, HttpError, json, requireMember, requireUser } from "../_shared/common.ts";
import { isPaidPlan, priceFor, stripe, stripeConfigured, TRIAL_DAYS } from "../_shared/stripe.ts";
import { syncSubscription, type StripeSub } from "../_shared/billing-sync.ts";

const LIVE = new Set(["trialing", "active", "past_due"]);

Deno.serve(handle(async (req) => {
  const db = admin();
  const user = await requireUser(req, db);
  const body = await req.json();
  const agencyId = String(body.agency_id ?? "");
  const role = await requireMember(db, agencyId, user.id);
  const { data: agency } = await db.from("agencies")
    .select("id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscribed_plan, current_period_end, cancel_at_period_end")
    .eq("id", agencyId).single();
  if (!agency) throw new HttpError(404, "Agency not found.");
  const appUrl = (Deno.env.get("APP_URL") ?? "https://partneraeo.com").replace(/\/$/, "");
  const back = (p: unknown) => `${appUrl}${typeof p === "string" && /^\/[\w\-/]*$/.test(p) ? p : "/billing"}`;

  if (body.action === "status") {
    const { data: lim } = await db.from("platform_limits").select("require_card").eq("id", 1).single();
    return json({ configured: stripeConfigured(), require_card: !!lim?.require_card && stripeConfigured(), trial_days: TRIAL_DAYS, ...agency, has_card: LIVE.has(agency.subscription_status ?? "") });
  }

  if (role === "member") throw new HttpError(403, "Ask an owner or admin to manage billing.");

  if (body.action === "portal") {
    if (!agency.stripe_customer_id) throw new HttpError(400, "There's no billing account yet. Choose a plan first.");
    const s = await stripe<{ url: string }>("POST", "billing_portal/sessions", { customer: agency.stripe_customer_id, return_url: back(body.return_path) });
    return json({ url: s.url });
  }

  if (body.action !== "checkout") throw new HttpError(400, "Unknown action.");
  const plan = body.plan;
  if (!isPaidPlan(plan)) throw new HttpError(400, "Choose Starter, Growth or Scale.");
  const price = await priceFor(plan);

  // Existing subscription: change it in place. Ending a trial charges the card now.
  if (agency.stripe_subscription_id && LIVE.has(agency.subscription_status ?? "")) {
    const sub = await stripe<StripeSub>("GET", `subscriptions/${agency.stripe_subscription_id}`);
    const updated = await stripe<StripeSub>("POST", `subscriptions/${sub.id}`, {
      items: [{ id: sub.items.data[0].id, price }],
      proration_behavior: "create_prorations",
      ...(sub.status === "trialing" ? { trial_end: "now" } : {}),
      cancel_at_period_end: false,
      metadata: { agency_id: agencyId, plan },
    });
    await syncSubscription(db, updated);
    return json({ updated: true, status: updated.status });
  }

  // New subscription through Checkout. The trial is for first-time subscribers only.
  let customer = agency.stripe_customer_id;
  if (!customer) {
    const c = await stripe<{ id: string }>("POST", "customers", { email: user.email, name: agency.name, metadata: { agency_id: agencyId } }, `customer-${agencyId}`);
    customer = c.id;
    await db.from("agencies").update({ stripe_customer_id: customer }).eq("id", agencyId);
  }
  const firstTime = !agency.stripe_subscription_id;
  const session = await stripe<{ url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    customer,
    client_reference_id: agencyId,
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: { ...(firstTime ? { trial_period_days: TRIAL_DAYS } : {}), metadata: { agency_id: agencyId, plan } },
    metadata: { agency_id: agencyId, plan },
    success_url: `${back(body.return_path)}?checkout=success`,
    cancel_url: `${back(body.return_path)}?checkout=cancel`,
  });
  return json({ url: session.url });
}));
