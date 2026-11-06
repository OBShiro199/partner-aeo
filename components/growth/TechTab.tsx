"use client";
import { Check, Warning, X } from "@phosphor-icons/react";
import type { Audit, TechAudit } from "@/lib/types";
import type { CheckStatus, PillarKey } from "@/supabase/functions/_shared/tech-audit.ts";
import { cx } from "@/components/ui";

const ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <span className="size-5 rounded-full grid place-items-center bg-[rgba(39,166,68,0.08)] border border-[#bfe3c8]"><Check size={11} weight="bold" className="text-[var(--success-ink)]" /></span>,
  warn: <span className="size-5 rounded-full grid place-items-center bg-[rgba(209,139,15,0.08)] border border-[#f0d7a8]"><Warning size={11} weight="bold" className="text-[var(--warning-ink)]" /></span>,
  fail: <span className="size-5 rounded-full grid place-items-center bg-[rgba(235,87,87,0.07)] border border-[#f5c4c4]"><X size={11} weight="bold" className="text-[var(--danger-ink)]" /></span>,
};
const tone = (n: number) => (n >= 70 ? "var(--success-ink)" : n >= 40 ? "var(--warning-ink)" : "var(--danger-ink)");

// The technical half of the audit: can AI crawlers reach, read and understand the site.
export function TechTab({ audit }: { audit: Audit }) {
  const t = audit.tech as TechAudit;
  const fails = t.checks.filter((c) => c.status === "fail").length;
  return (
    <>
      <section className="grid sm:grid-cols-2 lg:grid-cols-5 hair-b">
        <div className="p-4 md:p-6 lg:hair-r max-lg:hair-b">
          <p className="text-faint">AI readiness</p>
          <p className="mt-2"><span className="text-[34px] leading-none font-medium tnum tracking-[-0.04em]" style={{ color: tone(t.score) }}>{t.score}</span><span className="text-faint">/100</span></p>
          <p className="text-faint mt-2">{t.reachable ? `${fails} issue${fails === 1 ? "" : "s"} to fix` : "Site didn't respond"}</p>
        </div>
        {t.pillars.map((p, i) => (
          <div key={p.key} className={cx("p-4 md:p-6 min-w-0", i < 3 && "lg:hair-r", "max-lg:hair-b")}>
            <p className="text-faint truncate">{p.label}</p>
            <p className="mt-2"><span className="t-16 font-medium tnum" style={{ color: tone(p.score) }}>{p.score}</span><span className="text-faint">/100</span></p>
            <div className="h-1.5 rounded-full bg-hover overflow-hidden mt-3"><div className="h-full rounded-full" style={{ width: `${p.score}%`, background: tone(p.score) }} /></div>
          </div>
        ))}
      </section>
      {(Object.keys(GROUP) as PillarKey[]).map((k) => {
        const cs = t.checks.filter((c) => c.pillar === k);
        if (!cs.length) return null;
        return (
          <section key={k} className="p-4 md:p-6 hair-b">
            <h2 className="t-14 font-medium text-ink">{GROUP[k].title}</h2>
            <p className="text-faint mt-0.5">{GROUP[k].sub}</p>
            <ul className="card divide-y divide-divider mt-4">
              {cs.map((c) => (
                <li key={c.id} className="p-3 px-4 flex items-start gap-3">
                  <span className="mt-0.5 flex-none">{ICON[c.status]}</span>
                  <span className="min-w-0"><span className="block text-ink">{c.label}</span><span className={cx("block", c.status === "fail" ? "text-[var(--danger-ink)]" : "text-muted")}>{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="px-4 md:px-6 py-4 text-faint t-12">Checked {new Date(t.checked_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} from our servers, acting as each AI crawler. Requests come from a data centre, so a firewall result is a strong signal rather than proof. This page is in the prospect PDF.</p>
    </>
  );
}

const GROUP: Record<PillarKey, { title: string; sub: string }> = {
  access: { title: "AI crawler access", sub: "Can GPTBot, ClaudeBot and PerplexityBot reach the site?" },
  context: { title: "Context for AI", sub: "Can an AI read what the business does without running JavaScript?" },
  entity: { title: "Entity and schema", sub: "Does the site tell AI exactly what the business is and where?" },
  conversational: { title: "Answer readiness", sub: "Is there question-and-answer content AI can quote?" },
};
