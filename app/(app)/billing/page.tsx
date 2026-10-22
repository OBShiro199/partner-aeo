"use client";
import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { repo } from "@/lib/repo";
import { liveEngineIds } from "@/lib/engines";
import { plural, usd } from "@/lib/format";
import type { UsageRow } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { Button, cx, Meter } from "@/components/ui";

// Unit cost behind each plan: ~$0.026 per check, measured (ChatGPT $0.030, Perplexity $0.006, Gemini $0.037),
// 10 prompts x 4 engines x ~4.3 weekly scans = 172 checks, about $4.40 per client per month.
const PLANS = [
  { id: "starter", name: "Starter", price: 149, clients: 10, seats: 3, cadence: "Weekly scans", features: ["4 live answer engines", "10 prompts per client", "Client dashboards", "CSV export*"] },
  { id: "growth", name: "Growth", price: 349, clients: 30, seats: 10, cadence: "Weekly scans, on-demand checks", features: ["Everything in Starter", "Competitor share of voice", "White-label reports*", "Priority support"], popular: true },
  { id: "scale", name: "Scale", price: 899, clients: 100, seats: 50, cadence: "Twice-weekly scans", features: ["Everything in Growth", "API access*", "SSO*", "Dedicated onboarding"] },
];

export default function BillingPage() {
  const s = useApp();
  const a = s.agency!;
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  useEffect(() => { repo.usage(a.id).then(setUsage).catch(() => setUsage([])); }, [a.id]);
  const month = (usage ?? []).filter((u) => new Date(u.created_at).getMonth() === new Date().getMonth());
  const spend = month.reduce((x, u) => x + u.cost_usd, 0);
  const dfsCalls = month.filter((u) => u.provider === "dataforseo" && u.status === "ok").length;
  const engines = liveEngineIds(a.engines).length;
  const prompts = s.prompts.filter((p) => p.active).length;
  const projected = prompts * engines * 4.3 * 0.026;

  return (
    <>
      <Toolbar><span className="text-ink font-medium">Billing</span><span className="tag tag-blue capitalize">{a.plan}</span></Toolbar>
      <section className="grid md:grid-cols-3 hair-b">
        <Usage label="Clients" value={s.clients.length} max={a.client_limit} />
        <Usage label="Seats" value={s.members.length + s.invites.length} max={a.seat_limit} />
        <div className="p-4 md:p-6">
          <p className="text-faint">API spend this month</p>
          <p className="text-ink tnum font-medium text-[28px] leading-9 mt-2">{usd(spend, 2)}</p>
          <p className="text-faint mt-1">{plural(dfsCalls, "live check")} · projected {usd(projected)} at weekly scans</p>
        </div>
      </section>

      <section className="p-4 md:p-6 hair-b">
        <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h2 className="t-16 font-medium text-ink">Plans</h2>
            <p className="text-faint mt-0.5">Priced per agency, not per client. Every plan includes all live engines.</p>
          </div>
          <span className="text-faint">Card payments arrive with Stripe*</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {PLANS.map((p) => {
            const current = a.plan === p.id;
            return (
              <div key={p.id} className={cx("card p-5 flex flex-col", p.popular && "border-blue-edge")}>
                <div className="flex items-center justify-between">
                  <p className="text-ink font-medium t-14">{p.name}</p>
                  {p.popular && <span className="tag tag-blue">Most agencies</span>}
                </div>
                <p className="mt-3"><span className="text-ink text-[32px] leading-10 font-medium tnum tracking-[-0.04em]">${p.price}</span><span className="text-faint"> / month</span></p>
                <p className="text-muted mt-1">{p.clients} clients · {p.seats} seats · {p.cadence}</p>
                <ul className="flex flex-col gap-2 mt-5 mb-6">
                  {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check size={13} weight="bold" className="text-blue" /> {f}</li>)}
                </ul>
                <Button className="mt-auto" variant={p.popular ? "blue" : "default"} disabled title="Stripe isn't connected yet">{current ? "Current plan" : `Choose ${p.name}`}</Button>
              </div>
            );
          })}
        </div>
        <p className="text-faint mt-4">* Coming soon. Your trial includes 3 seats and {a.client_limit} clients.</p>
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
