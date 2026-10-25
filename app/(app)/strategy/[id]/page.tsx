"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { Toolbar } from "@/components/shell/Toolbar";
import { AuditView } from "@/components/growth/AuditView";
import { useAudit } from "@/components/growth/useAudit";
import { Empty } from "@/components/ui";

export default function StrategyRunPage() {
  const { id } = useParams<{ id: string }>();
  const s = useApp();
  const g = useGrowth();
  const { audit, missing } = useAudit(id);
  const lead = g.leads.find((l) => l.audit_id === id);
  const back = <Link href="/strategy" className="text-muted hover:text-ink inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Strategy Engine</Link>;

  if (missing) return <><Toolbar>{back}</Toolbar><Empty title="Analysis not found" body="It may have been deleted, or it belongs to another workspace." action={<Link href="/strategy" className="btn">Back</Link>} /></>;
  return (
    <>
      <Toolbar right={lead && <Link href={`/leads/${lead.id}`} className="btn btn-compact">Open lead</Link>}>
        {back}
        <span className="text-ghost">/</span>
        <span className="text-ink font-medium truncate">{audit?.prospect_name ?? audit?.prospect_domain ?? "Loading"}</span>
      </Toolbar>
      {audit ? (
        <AuditView audit={audit} agency={s.agency!} widget={g.widget} onRetry={async () => {
          try { await g.retry(audit.id); } catch (e) { s.toast((e as Error).message, { tone: "error" }); }
        }} />
      ) : <div className="p-6"><div className="skeleton h-5 w-1/2" /></div>}
    </>
  );
}
