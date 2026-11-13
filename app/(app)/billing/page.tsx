"use client";
import { useEffect, useState } from "react";
import { Check, CreditCard } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { isDemo, repo } from "@/lib/repo";
import { plural, usd } from "@/lib/format";
import { PLAN_CATALOG, planLines, type PaidPlan } from "@/lib/plan";
import type { BillingStatus, UsageRow } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { Button, cx, Meter } from "@/components/ui";

const day = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function BillingPage() {
  const s = useApp();
  const a = s.agency!;
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  const [bill, setBill] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = s.role === "owner" || s.role === "admin";

  useEffect(() => { repo.usage(a.id).then(setUsage).catch(() => setUsage([])); }, [a.id]);
  useEffect(() => { repo.billingStatus(a.id).then(setBill).catch(() => setBill(null)); }, [a.id, a.plan]);
  // Back from Stripe Checkout: the webhook moves the agency onto its plan within a few seconds.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("checkout");
    if (!q) return;
    window.history.replaceState(null, "", "/billing");
    if (q !== "success") { s.toast("Checkout cancelled. Nothing was charged."); return; }
    s.toast("Card saved. Your free trial has started.");
    const t = setTimeout(() => { s.refresh(); repo.billingStatus(a.id).then(setBill).catch(() => {}); }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const month = (usage ?? []).filter((u) => new Date(u.created_at).getMonth() === new Date().getMonth());
  const spend = month.reduce((x, u) => x + u.cost_usd, 0);
  const dfsCalls = month.filter((u) => u.provider === "dataforseo" && u.status === "ok").length;
  const sub = bill?.subscription_status ?? null;
  const live = sub === "trialing" || sub === "active" || sub === "past_due";

  function label(plan: PaidPlan) {
    const p = PLAN_CATALOG.find((x) => x.id === plan)!;
    if (!bill?.configured) return "Payments connect soon";
    if (!live) return sub ? `Choose ${p.name}` : `Start ${bill.trial_days}-day free trial`;
    if (sub === "trialing") return bill.subscribed_plan === plan ? `Start ${p.name} now` : `Switch to ${p.name} now`;
    return a.plan === plan ? "Current plan" : `Switch to ${p.name}`;
  }

  async function choose(plan: PaidPlan) {
    const p = PLAN_CATALOG.find((x) => x.id === plan)!;
    if (live) {
      const msg = sub === "trialing"
        ? `This ends your free trial and charges $${p.price} now for ${p.name}. Continue?`
        : `Switch to ${p.name} at $${p.price} a month? The difference is prorated on your next invoice.`;
      if (!window.confirm(msg)) return;
    }
    setBusy(plan);
    try {
      const r = await repo.checkout(a.id, plan, "/billing");
      if (r.url) { window.location.assign(r.url); return; }
      s.toast(`You're on ${p.name}.`);
      await s.refresh();
      setBill(await repo.billingStatus(a.id));
    } catch (e) { s.toast((e as Error).message, { tone: "error" }); }
    setBusy(null);
  }

  async function portal() {
    setBusy("portal");
    try { window.location.assign(await repo.billingPortal(a.id, "/billing")); }
    catch (e) { s.toast((e as Error).message, { tone: "error" }); setBusy(null); }
  }

  return (
    <>
      <Toolbar><span className="text-ink font-medium">Billing</span><span className="tag tag-blue capitalize">{a.plan}</span></Toolbar>
      <section className="grid md:grid-cols-3 hair-b">
        <Usage label="Clients" value={s.clients.length} max={a.client_limit} />
        <Usage label="Seats" value={s.members.length + s.invites.length} max={a.seat_limit} />
        <div className="p-4 md:p-6">
          <p className="text-faint">API spend this month</p>
          <p className="text-ink tnum font-medium text-[28px] leading-9 mt-2">{usd(spend, 2)}</p>
          <p className="text-faint mt-1">{plural(dfsCalls, "live check")} this month</p>
        </div>
      </section>

      {bill && sub && (
        <section className="px-4 md:px-6 py-3 hair-b flex items-center gap-3 flex-wrap">
          <CreditCard size={16} className="text-blue" />
          <span className="text-ink">
            {sub === "trialing" ? <>Free trial of <span className="font-medium capitalize">{bill.subscribed_plan}</span> until {day(bill.trial_ends_at)}. Paid features unlock when it converts, or start now.</>
              : sub === "past_due" ? <span className="text-[var(--danger-ink)]">Your last payment failed. Update your card to keep your plan.</span>
              : sub === "active" ? <>{bill.cancel_at_period_end ? "Cancels" : "Renews"} on {day(bill.current_period_end)}.</>
              : <>Your subscription has ended. Choose a plan to unlock paid features again.</>}
          </span>
          {canManage && a.stripe_customer_id && <Button size="compact" className="ml-auto" loading={busy === "portal"} onClick={portal}>Manage billing</Button>}
        </section>
      )}

      <section className="p-4 md:p-6 hair-b">
        <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h2 className="t-16 font-medium text-ink">Plans</h2>
            <p className="text-faint mt-0.5">Priced per agency, not per client. Every plan includes all live engines. Prices in USD.</p>
          </div>
          {!canManage && <span className="text-faint">Ask an owner or admin to change the plan.</span>}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {PLAN_CATALOG.map((p) => {
            const text = label(p.id);
            const current = text === "Current plan";
            return (
              <div key={p.id} className={cx("card p-5 flex flex-col", p.popular && "border-blue-edge")}>
                <div className="flex items-center justify-between">
                  <p className="text-ink font-medium t-14">{p.name}</p>
                  {current ? <span className="tag tag-green">Current</span> : p.popular && <span className="tag tag-blue">Most agencies</span>}
                </div>
                <p className="mt-3"><span className="text-ink text-[32px] leading-10 font-medium tnum tracking-[-0.04em]">${p.price}</span><span className="text-faint"> / month</span></p>
                <p className="text-muted mt-1">{p.clients} clients · {plural(p.seats, "seat")}</p>
                <ul className="flex flex-col gap-2 mt-5 mb-6">
                  {[...planLines(p), ...p.extras].map((f) => <li key={f} className="flex items-start gap-2"><Check size={13} weight="bold" className="text-blue mt-[3px] flex-none" />{f}</li>)}
                </ul>
                <Button className="mt-auto" variant={p.popular ? "blue" : "default"} loading={busy === p.id}
                  disabled={isDemo || !canManage || !bill?.configured || current || !!busy} onClick={() => choose(p.id)}>{text}</Button>
              </div>
            );
          })}
        </div>
        <p className="text-faint mt-4">* Arriving in the next releases. The free trial is {bill?.trial_days ?? 7} days with a card on file and $0 today. Cancel any time from Manage billing.</p>
      </section>

      <section className="p-4 md:p-6">
        <h2 className="t-14 font-medium text-ink mb-3">Usage log</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead><tr><th style={{ width: 170 }}>When</th><th style={{ width: 120 }}>Provider</th><th>Call</th><th style={{ width: 90 }}>Status</th><th style={{ width: 100 }} className="text-right">Cost</th></tr></thead>
            <tbody>
              {(usage ?? []).slice(0, 50).map((u, i) => (
                <tr key={i}>
                  <td className="text-faint tnum">{new Date(u.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="capitalize">{u.provider === "dataforseo" ? "DataForSEO" : u.provider}</td>
                  <td className="text-ink">{u.endpoint}</td>
                  <td><span className={cx("tag", u.status === "ok" ? "tag-green" : u.status === "blocked" ? "tag-amber" : "tag-red")}>{u.status}</span></td>
                  <td className="text-right tnum">{usd(u.cost_usd, 4)}</td>
                </tr>
              ))}
              {usage && !usage.length && <tr><td colSpan={5} className="text-muted">No paid calls yet.</td></tr>}
              {!usage && <tr><td colSpan={5}><div className="skeleton h-4 w-1/2" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Usage({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="p-4 md:p-6 md:hair-r max-md:hair-b">
      <p className="text-faint">{label}</p>
      <p className="mt-2 mb-3"><span className="text-ink tnum font-medium text-[28px] leading-9">{value}</span><span className="text-faint tnum"> of {max}</span></p>
      <Meter value={value} max={max} label={`${label} used`} />
    </div>
  );
}
