// Copy a Stripe subscription onto the agency row and move the agency onto the right plan.
// Used by the webhook (source of truth) and by the billing function right after a plan change.
//   trialing          -> plan 'trial' (paid features stay locked until the trial converts or they upgrade)
//   active, past_due  -> the subscribed plan (past_due is Stripe's retry window)
//   canceled, unpaid, incomplete_expired -> back to 'trial' limits (data is kept)
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { planFromLookup, isPaidPlan } from "./stripe.ts";

export type StripeSub = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  trial_end: number | null;
  metadata: Record<string, string>;
  items: { data: { id: string; price: { id: string; lookup_key: string | null } }[] };
};

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

export async function syncSubscription(db: SupabaseClient, sub: StripeSub): Promise<string | null> {
  let agencyId = sub.metadata?.agency_id ?? null;
  if (!agencyId) {
    const { data } = await db.from("agencies").select("id").eq("stripe_customer_id", sub.customer).maybeSingle();
    agencyId = data?.id ?? null;
  }
  if (!agencyId) { console.error("stripe sub without agency", sub.id); return null; }

  const picked = planFromLookup(sub.items?.data?.[0]?.price?.lookup_key) ?? (isPaidPlan(sub.metadata?.plan) ? sub.metadata.plan : null);
  const effective = (sub.status === "active" || sub.status === "past_due") && picked ? picked : sub.status === "incomplete" ? null : "trial";

  const { error } = await db.from("agencies").update({
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscribed_plan: picked,
    current_period_end: ts(sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    ...(sub.trial_end ? { trial_ends_at: ts(sub.trial_end) } : {}),
  }).eq("id", agencyId);
  if (error) throw error;
  if (effective) {
    const { error: e2 } = await db.rpc("apply_plan", { p_agency: agencyId, p_plan: effective });
    if (e2) throw e2;
  }
  return agencyId;
}
