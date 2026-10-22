"use client";
import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { normaliseDomain, faviconFor } from "@/lib/format";
import { liveEngineIds } from "@/lib/engines";
import type { Role } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { EnginePicker, RegionGrid } from "@/components/pickers";
import { Button, cx, Favicon, Field } from "@/components/ui";

const SECTIONS = [
  { id: "agency", label: "Agency" },
  { id: "markets", label: "Markets" },
  { id: "engines", label: "Answer engines" },
  { id: "team", label: "Team and seats" },
];

export default function SettingsPage() {
  const s = useApp();
  const a = s.agency!;
  const canEdit = s.role !== "member";
  const [name, setName] = useState(a.name);
  const [site, setSite] = useState(a.domain ?? "");
  const [regions, setRegions] = useState(a.regions);
  const [engines, setEngines] = useState(a.engines);
  const [saving, setSaving] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  async function save(section: string, patch: Parameters<typeof s.updateAgency>[0]) {
    setSaving(section);
    try { await s.updateAgency(patch); s.toast("Settings saved"); } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setSaving(null); }
  }

  return (
    <>
      <Toolbar><span className="text-ink font-medium">Settings</span></Toolbar>
      <div className="grid md:grid-cols-[200px_1fr]">
        <nav className="hidden md:flex flex-col gap-0.5 p-4 hair-r sticky top-[48px] self-start">
          {SECTIONS.map((x) => <a key={x.id} href={`#${x.id}`} className="h-8 px-2 flex items-center rounded-md text-muted hover:bg-hover hover:text-ink">{x.label}</a>)}
        </nav>
        <div className="min-w-0 max-w-[760px]">
          <Section id="agency" title="Agency" sub="Shown top left for everyone on your team.">
            <div className="flex items-center gap-4 mb-5">
              <Favicon src={normaliseDomain(site) === a.domain ? a.favicon_url : null} domain={normaliseDomain(site)} name={name} size={44} />
              <p className="text-faint">Your logo comes from your website&apos;s icon.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Agency name" htmlFor="ag-name"><input id="ag-name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Website" htmlFor="ag-site"><input id="ag-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} disabled={!canEdit} /></Field>
            </div>
            <SaveRow disabled={!canEdit} loading={saving === "agency"} onClick={() => {
              const d = normaliseDomain(site);
              save("agency", { name: name.trim() || a.name, domain: d, website: d ? `https://${d}` : null, favicon_url: d && d !== a.domain ? faviconFor(d, 128) : a.favicon_url });
            }} />
          </Section>

          <Section id="markets" title="Markets" sub="New clients default to your first market.">
            <RegionGrid value={regions} onChange={setRegions} />
            <SaveRow disabled={!canEdit || !regions.length} loading={saving === "markets"} onClick={() => save("markets", { regions })} />
          </Section>

          <Section id="engines" title="Answer engines" sub={`${liveEngineIds(engines).length} live of ${engines.length} selected. Up to 10.`}>
            <EnginePicker value={engines} onChange={setEngines} />
            <SaveRow disabled={!canEdit || !liveEngineIds(engines).length} loading={saving === "engines"} onClick={() => save("engines", { engines })} />
          </Section>

          <Section id="team" title="Team and seats" sub={`${s.members.length + s.invites.length} of ${a.seat_limit} seats used. Invites hold a seat until accepted.`}>
            <ul className="card divide-y divide-divider mb-4">
              {s.members.map((m) => (
                <li key={m.user_id} className="min-h-12 py-2 px-4 flex items-center gap-3">
                  <span className="size-7 rounded-full bg-hover grid place-items-center text-muted font-medium">{(m.full_name || m.email).charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block text-ink truncate">{m.full_name || m.email}</span><span className="block text-faint t-12 truncate">{m.email}</span></span>
                  <span className={cx("tag capitalize", m.role === "owner" && "tag-blue")}>{m.role}</span>
                  {canEdit && m.role !== "owner" && m.user_id !== s.user?.id && (
                    <button className="btn btn-ghost btn-icon h-7 w-7" aria-label={`Remove ${m.email}`} onClick={() => s.removeMember(m.user_id).then(() => s.toast("Member removed"))}><Trash size={14} /></button>
                  )}
                </li>
              ))}
              {s.invites.map((i) => (
                <li key={i.id} className="min-h-12 py-2 px-4 flex items-center gap-3">
                  <span className="size-7 rounded-full border border-dashed border-btn-edge" />
                  <span className="min-w-0 flex-1"><span className="block text-body truncate">{i.email}</span><span className="block text-faint t-12">Invite pending</span></span>
                  <span className="tag capitalize">{i.role}</span>
                  {canEdit && <button className="btn btn-ghost btn-compact" onClick={() => s.revokeInvite(i.id).then(() => s.toast("Invite revoked"))}>Revoke</button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
                e.preventDefault();
                setInviteErr(null);
                if (!/^\S+@\S+\.\S+$/.test(email)) return setInviteErr("Enter a valid email.");
                try { await s.invite(email.trim(), role); setEmail(""); s.toast("Invite created"); } catch (err) { setInviteErr((err as Error).message); }
              }}>
                <input className="input flex-1 min-w-[220px]" placeholder="teammate@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" />
                <div className="flex rounded-md border border-hairline p-0.5">
                  {(["member", "admin"] as const).map((r) => (
                    <button type="button" key={r} onClick={() => setRole(r)} aria-pressed={role === r} className={cx("h-[30px] px-3 rounded-[4px] capitalize", role === r ? "bg-blue-soft text-blue-ink font-medium" : "text-muted")}>{r}</button>
                  ))}
                </div>
                <Button type="submit" variant="primary">Send invite</Button>
                <p role="alert" className="field-error w-full">{inviteErr}</p>
              </form>
            )}
            <p className="text-faint">Invite emails send once Resend is connected*. Until then, share the sign-up link and they join when they sign up with the invited email.</p>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="p-4 md:p-6 hair-b scroll-mt-14">
      <h2 className="t-16 font-medium text-ink">{title}</h2>
      <p className="text-faint mt-0.5 mb-5">{sub}</p>
      {children}
    </section>
  );
}

function SaveRow({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) {
  return <div className="mt-5"><Button variant="primary" onClick={onClick} loading={loading} disabled={disabled} minWidth={120}>Save changes</Button></div>;
}
