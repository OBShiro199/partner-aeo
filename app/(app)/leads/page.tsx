"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MagnifyingGlass, Tray } from "@phosphor-icons/react";
import { useGrowth } from "@/lib/growth";
import { ago } from "@/lib/format";
import type { LeadStatus } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { RiskTag } from "@/components/growth/AuditView";
import { LeadStatusTag, LEAD_STATUSES } from "@/components/growth/LeadStatus";
import { Empty, Favicon } from "@/components/ui";

export default function LeadsPage() {
  const g = useGrowth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const audits = useMemo(() => new Map(g.audits.map((a) => [a.id, a])), [g.audits]);
  const rows = g.leads
    .map((l) => ({ lead: l, audit: audits.get(l.audit_id) }))
    .filter(({ lead, audit }) => (status === "all" || lead.status === status) &&
      `${lead.name ?? ""} ${lead.email} ${audit?.prospect_domain ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Toolbar>
        <span className="text-ink font-medium">Leads</span>
        <span className="tag tnum">{g.leads.length}</span>
        <div className="relative hidden sm:block ml-2">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input h-8 w-[240px] pl-8" placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Toolbar>
      <div className="h-[44px] hair-b flex items-center gap-1.5 px-4 md:px-6 overflow-x-auto no-scrollbar">
        {(["all", ...LEAD_STATUSES] as const).map((k) => (
          <button key={k} className="chip h-7 capitalize" aria-pressed={status === k} onClick={() => setStatus(k)}>
            {k} <span className="tnum text-faint">{k === "all" ? g.leads.length : g.leads.filter((l) => l.status === k).length}</span>
          </button>
        ))}
      </div>

      {!g.loaded ? (
        <div className="p-6"><div className="skeleton h-5 w-1/3" /></div>
      ) : !g.leads.length ? (
        <Empty icon={<Tray size={18} />} title="No leads yet" body="Leads arrive when a visitor runs your website scanner and asks for the full report. Each one comes with a strategy pack and a closing deck." action={<Link href="/widget" className="btn btn-primary">Set up the widget</Link>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th style={{ width: 240 }}>Lead</th>
                <th style={{ width: 230 }}>Business</th>
                <th>Searched for</th>
                <th style={{ width: 150 }}>AI Search Score</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 110 }}>Captured</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lead, audit }) => (
                <tr key={lead.id} className="cursor-pointer" onClick={() => router.push(`/leads/${lead.id}`)}>
                  <td className="min-w-0">
                    <Link href={`/leads/${lead.id}`} className="block text-ink font-medium truncate" onClick={(e) => e.stopPropagation()}>{lead.name || lead.email}</Link>
                    <span className="block text-faint t-12 truncate">{lead.name ? lead.email : lead.phone}</span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Favicon domain={audit?.prospect_domain} name={audit?.prospect_name ?? audit?.prospect_domain} size={20} />
                      <span className="truncate text-ink">{audit?.prospect_name ?? audit?.prospect_domain ?? "–"}</span>
                    </span>
                  </td>
                  <td className="text-muted truncate">{audit ? <>&ldquo;{audit.keyword}&rdquo;{audit.competitor_name || audit.competitor_domain ? <span className="text-faint"> vs {audit.competitor_name ?? audit.competitor_domain}</span> : null}</> : "–"}</td>
                  <td><span className="flex items-center gap-2"><span className="text-ink tnum font-medium">{audit?.score ?? "–"}</span><RiskTag risk={audit?.risk ?? null} /></span></td>
                  <td><LeadStatusTag status={lead.status} /></td>
                  <td className="text-faint">{ago(lead.created_at)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-muted">No leads match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
