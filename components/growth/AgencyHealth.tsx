"use client";
// PRD heading 6: the agency's own AI readiness, top of the dashboard. On the trial the fixes are
// shown as locked (Day-1 fixes for the agency are a Starter feature); paid plans get a link to them.
import Link from "next/link";
import { useState } from "react";
import { Buildings, LockSimple, Warning } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { isTrial } from "@/lib/plan";
import type { TechAudit } from "@/lib/types";
import { Button, Favicon } from "@/components/ui";
import { useUpgrade } from "./Upgrade";

export function AgencyHealth() {
  const s = useApp();
  const g = useGrowth();
  const show = useUpgrade((u) => u.show);
  const [busy, setBusy] = useState(false);
  const a = s.agency;
  if (!a || !g.loaded) return null;
  const self = g.audits.find((x) => x.sprint_role === "self");
  const t = self?.tech as TechAudit | undefined;
  const trial = isTrial(a);
  const name = (a.domain ?? a.name).replace(/^www\./, "").split(".")[0].toUpperCase();

  // Not audited yet: offer it (needs the agency website on file).
  if (!t?.checks?.length) {
    if (self || !a.domain) return null;
    return (
      <div className="mx-4 md:mx-6 mt-4 card px-4 py-3 flex items-center gap-3 flex-wrap">
        <Buildings size={16} className="text-blue" />
        <span className="flex-1 min-w-0"><span className="text-ink font-medium">Is your own agency visible in AI search?</span> <span className="text-muted">Run the same audit on {a.domain}. Free, once.</span></span>
        <Button size="compact" variant="blue" loading={busy} onClick={async () => {
          setBusy(true);
          try { await g.selfAudit(); } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setBusy(false); }
        }}>Audit my agency</Button>
      </div>
    );
  }

  const fails = t.checks.filter((c) => c.status === "fail");
  const tone = t.score >= 70 ? "var(--success-ink)" : t.score >= 40 ? "var(--warning-ink)" : "var(--danger-ink)";
  return (
    <div className="mx-4 md:mx-6 mt-4 card p-4 flex gap-4 flex-wrap items-start">
      <Favicon src={a.favicon_url} domain={a.domain} name={a.name} size={32} />
      <div className="flex-1 min-w-[240px]">
        <p className="text-ink font-medium">Your agency health: {name} scored <span className="tnum" style={{ color: tone }}>{t.score}/100</span></p>
        {fails.length ? (
          <ul className="mt-1.5 flex flex-col gap-1">
            {fails.slice(0, 3).map((c) => <li key={c.id} className="flex items-start gap-1.5 text-muted"><Warning size={13} className="mt-[3px] flex-none text-[var(--danger-ink)]" /><span><span className="text-ink">{c.label}.</span> {c.detail}</span></li>)}
          </ul>
        ) : <p className="text-muted mt-1">No blocking issues found. AI crawlers can read your site.</p>}
      </div>
      <div className="flex gap-2 items-center">
        <Link href={`/strategy/${self!.id}`} className="btn btn-compact btn-ghost">See the audit</Link>
        {trial
          ? <Button size="compact" variant="primary" onClick={() => show("fixes")}><LockSimple size={13} /> Unlock agency Day-1 fixes</Button>
          : <Link href={`/strategy/${self!.id}`} className="btn btn-compact btn-primary">Fix these</Link>}
      </div>
    </div>
  );
}
