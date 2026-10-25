"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, EnvelopeSimple, Phone } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { ago } from "@/lib/format";
import type { LeadStatus } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { AuditView } from "@/components/growth/AuditView";
import { LEAD_STATUSES } from "@/components/growth/LeadStatus";
import { useAudit } from "@/components/growth/useAudit";
import { cx, Empty } from "@/components/ui";

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const s = useApp();
  const g = useGrowth();
  const lead = g.leads.find((l) => l.id === id);
  const { audit } = useAudit(lead?.audit_id);
  const [notes, setNotes] = useState(lead?.notes ?? "");
  useEffect(() => setNotes(lead?.notes ?? ""), [lead?.id, lead?.notes]);

  const back = <Link href="/leads" className="text-muted hover:text-ink inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Leads</Link>;
  if (!g.loaded) return <><Toolbar>{back}</Toolbar><div className="p-6"><div className="skeleton h-5 w-1/3" /></div></>;
  if (!lead) return <><Toolbar>{back}</Toolbar><Empty title="Lead not found" body="It may have been deleted, or it belongs to another workspace." action={<Link href="/leads" className="btn">Back to leads</Link>} /></>;

  async function update(patch: { status?: LeadStatus; notes?: string }) {
    try { await g.updateLead(lead!.id, patch); if (patch.status) s.toast(`Marked as ${patch.status}`); }
    catch (e) { s.toast((e as Error).message, { tone: "error" }); }
  }

  return (
    <>
      <Toolbar>
        {back}
        <span className="text-ghost">/</span>
        <span className="text-ink font-medium truncate">{lead.name || lead.email}</span>
      </Toolbar>

      <section className="hair-b px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-ink font-medium">{lead.name || "No name given"}</p>
          <p className="text-faint t-12">Captured {ago(lead.created_at)}{audit?.host ? ` on ${audit.host}` : ""} · {lead.report_sent_at ? `report emailed ${ago(lead.report_sent_at)}` : "report queued"}</p>
        </div>
        <a href={`mailto:${lead.email}`} className="btn btn-compact"><EnvelopeSimple size={14} /> {lead.email}</a>
        <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="btn btn-compact"><Phone size={14} /> {lead.phone}</a>
        <div className="flex rounded-md border border-hairline p-0.5 ml-auto" role="radiogroup" aria-label="Lead status">
          {LEAD_STATUSES.map((st) => (
            <button key={st} role="radio" aria-checked={lead.status === st} onClick={() => update({ status: st })}
              className={cx("h-[28px] px-2.5 rounded-[4px] capitalize", lead.status === st ? "bg-blue-soft text-blue-ink font-medium" : "text-muted hover:text-ink")}>{st}</button>
          ))}
        </div>
        <textarea className="input w-full min-h-[40px] py-2" placeholder="Notes about this lead" value={notes}
          onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (lead.notes ?? "") && update({ notes })} />
      </section>

      {audit ? (
        <AuditView audit={audit} agency={s.agency!} widget={g.widget} onRetry={async () => {
          try { await g.retry(audit.id); } catch (e) { s.toast((e as Error).message, { tone: "error" }); }
        }} />
      ) : <div className="p-6"><div className="skeleton h-5 w-1/2" /></div>}
    </>
  );
}
