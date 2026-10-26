"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DotsThree, DownloadSimple, MagnifyingGlass, Plus, UsersThree } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { clientTable } from "@/lib/stats";
import { FlagIcon, regionByCode } from "@/lib/regions";
import { ago, pct, plural, score } from "@/lib/format";
import { downloadCsv, today } from "@/lib/csv";
import { Toolbar } from "@/components/shell/Toolbar";
import { Bar } from "@/components/charts";
import { Button, cx, Delta, Empty, Favicon, Menu, Sparkline } from "@/components/ui";

export default function ClientsPage() {
  const s = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");
  const rows = useMemo(() => clientTable(s.clients, s.results, s.rangeDays), [s.clients, s.results, s.rangeDays]);
  const list = rows.filter((r) =>
    (status === "all" || r.client.status === status) &&
    (r.client.name.toLowerCase().includes(q.toLowerCase()) || r.client.domain.includes(q.toLowerCase())));

  return (
    <>
      <Toolbar right={<>
        {rows.length > 0 && (
          <button className="btn btn-compact btn-ghost max-sm:hidden" onClick={() => downloadCsv(`clients-${today()}.csv`, [
            ["Client", "Domain", "Market", "Status", `Visibility (${s.rangeDays}d)`, "Change", "Mention rate", "Citation rate", "Answers", "Last checked"],
            ...list.map((r) => [r.client.name, r.client.domain, r.client.region, r.client.status, r.visibility == null ? null : Math.round(r.visibility),
              r.delta == null ? null : Math.round(r.delta), pct(r.mentionRate), pct(r.citationRate), r.answers, r.lastChecked?.slice(0, 10)]),
          ])}><DownloadSimple size={14} /> Export CSV</button>
        )}
        <Button size="compact" variant="primary" onClick={() => s.setAddClientOpen(true)}><Plus size={14} className="text-blue" /> Add client</Button>
      </>}>
        <span className="text-ink font-medium">Clients</span>
        <span className="tag tnum">{s.clients.length}/{s.agency!.client_limit}</span>
        <div className="relative hidden sm:block ml-2">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input h-8 w-[240px] pl-8" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Toolbar>
      <div className="h-[44px] hair-b flex items-center gap-1.5 px-4 md:px-6 overflow-x-auto no-scrollbar">
        {(["all", "active", "paused"] as const).map((k) => (
          <button key={k} className="chip h-7 capitalize" aria-pressed={status === k} onClick={() => setStatus(k)}>
            {k} <span className="tnum text-faint">{k === "all" ? s.clients.length : s.clients.filter((c) => c.status === k).length}</span>
          </button>
        ))}
      </div>

      {!s.clients.length ? (
        <Empty icon={<UsersThree size={18} />} title="No clients yet" body="Add a client by domain. We'll read the site and write their prompts." action={<Button variant="primary" onClick={() => s.setAddClientOpen(true)}><Plus size={14} /> Add client</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th style={{ width: 280 }}>Client</th>
                <th style={{ width: 150 }}>Market</th>
                <th style={{ width: 90 }}>Prompts</th>
                <th style={{ width: 130 }}>Visibility</th>
                <th style={{ width: 80 }}>Change</th>
                <th style={{ width: 100 }}>Mentions</th>
                <th style={{ width: 110 }}>Trend</th>
                <th style={{ width: 100 }}>Checked</th>
                <th style={{ width: 48 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.client.id} className="rise cursor-pointer" style={{ animationDelay: `${Math.min(i * 25, 270)}ms` }} onClick={() => router.push(`/clients/${r.client.id}`)}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Favicon src={r.client.favicon_url} domain={r.client.domain} name={r.client.name} size={24} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2"><span className="text-ink font-medium truncate">{r.client.name}</span>{r.client.status === "paused" && <span className="tag">Paused</span>}</span>
                        <span className="block text-faint t-12 truncate">{r.client.domain}</span>
                      </span>
                    </span>
                  </td>
                  <td><span className="flex items-center gap-2"><FlagIcon code={r.client.region} size={16} /><span className="truncate">{regionByCode(r.client.region)?.name}</span></span></td>
                  <td className="tnum">{s.prompts.filter((p) => p.client_id === r.client.id && p.active).length}</td>
                  <td><span className="flex items-center gap-2"><span className="tnum text-ink font-medium w-6">{score(r.visibility)}</span><span className="flex-1 max-w-[60px]"><Bar value={r.visibility != null ? r.visibility / 100 : null} /></span></span></td>
                  <td><Delta value={r.delta} /></td>
                  <td className="tnum">{pct(r.mentionRate)}</td>
                  <td><Sparkline values={r.spark} /></td>
                  <td className="text-faint">{ago(r.lastChecked)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Menu align="end" width={200} trigger={(p) => <button {...p} className="btn btn-ghost btn-icon" aria-label={`Actions for ${r.client.name}`}><DotsThree size={18} weight="bold" /></button>}>
                      {(close) => (
                        <>
                          <Link href={`/clients/${r.client.id}`} className="menu-item" onClick={close}>Open</Link>
                          <button className="menu-item" onClick={() => { s.setFilterClient(r.client.id); router.push("/dashboard"); close(); }}>View on dashboard</button>
                          <button className="menu-item" onClick={async () => { close(); await s.updateClient(r.client.id, { status: r.client.status === "paused" ? "active" : "paused" }); s.toast(r.client.status === "paused" ? "Tracking resumed" : "Tracking paused"); }}>
                            {r.client.status === "paused" ? "Resume tracking" : "Pause tracking"}
                          </button>
                          <div className="h-px bg-divider my-1" />
                          <button className={cx("menu-item text-danger-ink")} onClick={async () => {
                            close();
                            if (!confirm(`Delete ${r.client.name} and all its history? This can't be undone.`)) return;
                            await s.deleteClient(r.client.id);
                            s.toast(`${r.client.name} deleted`);
                          }}>Delete client</button>
                        </>
                      )}
                    </Menu>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={9} className="text-muted">No clients match.</td></tr>}
            </tbody>
          </table>
          <p className="px-4 md:px-6 py-3 text-faint">{plural(list.length, "client")} · last {s.rangeDays} days</p>
        </div>
      )}
    </>
  );
}
