"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Buildings, Code, FilePdf, Gift, Lightning, LockSimple, MagnifyingGlass, MapPin, Phone, PresentationChart, Star, Wrench } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { isDemo } from "@/lib/repo";
import { isTrial, type Feature } from "@/lib/plan";
import { clearSprint, readSprint } from "@/lib/sprint";
import { downloadReportPdf } from "@/lib/sales-files";
import { normaliseDomain } from "@/lib/format";
import type { Audit, SprintBusiness, TechAudit } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { RegionSelect } from "@/components/pickers";
import { RiskTag, isStuck } from "@/components/growth/AuditView";
import { useUpgrade } from "@/components/growth/Upgrade";
import { Button, cx, Favicon, Field, LiveStatus } from "@/components/ui";

export default function SprintPage() {
  const s = useApp();
  const g = useGrowth();
  const sprint = g.audits.filter((a) => a.source === "sprint");
  const client = sprint.find((a) => a.sprint_role === "client");
  const leads = sprint.filter((a) => a.sprint_role === "lead").sort((a, b) => ((a.tech as TechAudit).score ?? 0) - ((b.tech as TechAudit).score ?? 0));
  const self = sprint.find((a) => a.sprint_role === "self");

  return (
    <>
      <Toolbar>
        <span className="text-ink font-medium">Free audits</span>
        {isTrial(s.agency) && <span className="tag tag-blue">Included in your trial</span>}
      </Toolbar>
      {!g.loaded ? <div className="p-6"><div className="skeleton h-5 w-1/3" /></div> : !client ? <Intake /> : (
        <>
          <Section title="Your client" sub={`${client.keyword}. Benchmarked against ${client.competitor_name ?? client.competitor_domain ?? "the local market leader"}, the top Google Maps result.`}>
            <div className="grid lg:grid-cols-2 gap-3"><AuditCard a={client} big /></div>
          </Section>
          <Section title={`${leads.length} prospects with weak AI visibility`} sub="Found on Google Maps for your niche and location, then audited. The weakest sites are first. Download each branded audit and send it to them.">
            {leads.length ? <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{leads.map((a) => <AuditCard key={a.id} a={a} />)}</div>
              : <p className="text-muted">No local businesses with a reachable website came up for this search.</p>}
            <MoreLeads />
          </Section>
          <Section title="Your own agency" sub="How visible is your agency in AI search? Run the same audit on your own site.">
            {self ? <div className="grid lg:grid-cols-2 gap-3"><AuditCard a={self} big /></div> : <SelfAudit />}
          </Section>
          <Branding />
          <Paywalled />
        </>
      )}
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="p-4 md:p-6 hair-b">
      <h2 className="t-14 font-medium text-ink">{title}</h2>
      {sub && <p className="text-faint mt-0.5 mb-4 max-w-[760px]">{sub}</p>}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
function Intake() {
  const s = useApp();
  const g = useGrowth();
  const [f, setF] = useState({ client_url: "", niche: "", location: "", region: s.agency!.regions.find((r) => r !== "GLOBAL") ?? "US" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const v = readSprint(); if (v) setF((x) => ({ ...x, ...v, region: v.region ?? x.region })); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const client = normaliseDomain(f.client_url);
    if (!client) return setErr("Enter your client's website, like clientdomain.com.");
    if (f.niche.trim().length < 3) return setErr("Add the niche you want leads in, like \"roofing contractors\".");
    if (f.location.trim().length < 2) return setErr("Add a town or city, like \"Denver, CO\".");
    setBusy(true);
    try {
      await g.startSprint({ client_url: client, niche: f.niche.trim(), location: f.location.trim(), region: f.region });
      clearSprint();
      s.toast("Audits started. They take a few minutes.");
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="relative hair-b overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-70" style={{ maskImage: "linear-gradient(to bottom, #000 40%, transparent)" }} aria-hidden />
      <form onSubmit={go} className="relative card m-4 md:m-6 p-5 md:p-7 max-w-[760px]" noValidate>
        <p className="text-blue-ink font-medium flex items-center gap-2"><Gift size={15} /> Free with your trial</p>
        <h1 className="h2 mt-2">1 client audit + 5 local leads</h1>
        <p className="text-muted mt-1 mb-6">We audit a client you already have, then find 5 businesses in your niche with weak AI visibility. Each comes with a branded PDF you can send today.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Your client's website" htmlFor="sp-c"><input id="sp-c" className="input" placeholder="clientdomain.com" value={f.client_url} onChange={(e) => setF({ ...f, client_url: e.target.value })} /></Field>
          <Field label="Niche for new leads" htmlFor="sp-n"><input id="sp-n" className="input" placeholder="e.g. roofing contractors" maxLength={60} value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} /></Field>
          <Field label="Town or city" htmlFor="sp-l"><input id="sp-l" className="input" placeholder="e.g. Denver, CO" maxLength={60} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Country" htmlFor="sp-r"><RegionSelect id="sp-r" value={f.region} onChange={(v) => setF({ ...f, region: v })} /></Field>
        </div>
        <p role="alert" className="field-error mt-3">{err}</p>
        <Button type="submit" variant="primary" size="large" loading={busy} disabled={isDemo} className="mt-2">
          Generate my free audits <ArrowRight size={15} className="text-blue" />
        </Button>
        <p className="text-faint mt-3">One free run per agency. It takes a few minutes; you can leave this page.</p>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
function AuditCard({ a, big }: { a: Audit; big?: boolean }) {
  const s = useApp();
  const g = useGrowth();
  const [busy, setBusy] = useState(false);
  const t = a.tech as TechAudit;
  const b = a.business as SprintBusiness;
  const running = (a.status === "queued" || a.status === "running") && !isStuck(a);
  const failed = a.status === "failed" || isStuck(a);
  const name = a.prospect_name ?? b.name ?? a.prospect_domain;

  async function pdf() {
    setBusy(true);
    try {
      const full = g.full[a.id] ?? (await g.loadAudit(a.id));
      if (full) await downloadReportPdf(full, { agency: s.agency!, widget: g.widget });
    } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <div className={cx("card p-4 flex flex-col gap-3 min-w-0", big && "md:p-5")}>
      <div className="flex items-start gap-3 min-w-0">
        <Favicon domain={a.prospect_domain} name={name} size={big ? 36 : 28} />
        <div className="min-w-0 flex-1">
          <p className="text-ink font-medium truncate">{name}</p>
          <p className="text-faint truncate">{a.prospect_domain}</p>
        </div>
        {b.maps_rank ? <span className="tag tnum" title="Position in Google Maps results">#{b.maps_rank} on Maps</span> : null}
      </div>
      {(b.phone || b.address || b.rating != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted t-12">
          {b.rating != null && <span className="inline-flex items-center gap-1"><Star size={12} weight="fill" className="text-[var(--warning-ink)]" />{b.rating} ({b.votes ?? 0})</span>}
          {b.phone && <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-ink"><Phone size={12} />{b.phone}</a>}
          {b.address && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={12} className="flex-none" /><span className="truncate">{b.address}</span></span>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Metric label="AI readiness" value={t?.checks ? t.score : null} hint={t?.checks ? `${t.checks.filter((c) => c.status === "fail").length} issues` : undefined} />
        <Metric label="AI Search Score" value={a.status === "complete" ? a.score : null} hint={running ? "Checking engines" : failed ? "Didn't finish" : undefined} extra={a.status === "complete" ? <RiskTag risk={a.risk} /> : null} />
      </div>
      <div className="flex items-center gap-2 mt-auto pt-1">
        {running ? <LiveStatus label={a.status === "queued" ? "Waiting to start" : a.stage ?? "Running"} /> : failed ? <span className="text-[var(--danger-ink)] t-12">{a.error ?? "Stopped early."}</span> : null}
        <span className="ml-auto flex gap-1.5">
          <Link href={`/strategy/${a.id}`} className="btn btn-compact btn-ghost">Open</Link>
          <Button size="compact" disabled={a.status !== "complete"} loading={busy} onClick={pdf}><FilePdf size={14} /> PDF</Button>
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, extra }: { label: string; value: number | null; hint?: string; extra?: React.ReactNode }) {
  const tone = value == null ? "var(--ghost)" : value >= 70 ? "var(--success-ink)" : value >= 40 ? "var(--warning-ink)" : "var(--danger-ink)";
  return (
    <div className="rounded-md border border-divider p-2.5">
      <p className="text-faint t-12">{label}</p>
      <p className="flex items-center gap-2 mt-0.5"><span className="t-16 font-medium tnum" style={{ color: tone }}>{value ?? "–"}</span>{value != null && <span className="text-faint t-12">/100</span>}{extra}</p>
      {hint && <p className="text-faint t-12">{hint}</p>}
    </div>
  );
}

function SelfAudit() {
  const s = useApp();
  const g = useGrowth();
  const [busy, setBusy] = useState(false);
  return (
    <div className="card p-4 flex items-center gap-3 max-w-[560px]">
      <Favicon src={s.agency!.favicon_url} domain={s.agency!.domain} name={s.agency!.name} size={28} />
      <span className="flex-1 min-w-0"><span className="block text-ink font-medium truncate">{s.agency!.name}</span><span className="block text-faint truncate">{s.agency!.domain ?? "Add your website in Settings"}</span></span>
      <Button size="compact" variant="blue" loading={busy} disabled={!s.agency!.domain} onClick={async () => {
        setBusy(true);
        try { await g.selfAudit(); s.toast("Auditing your agency"); } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setBusy(false); }
      }}><Buildings size={14} /> Audit my agency</Button>
    </div>
  );
}

function MoreLeads() {
  const s = useApp();
  const show = useUpgrade((u) => u.show);
  if (!isTrial(s.agency)) return null;
  return (
    <button onClick={() => show("more_leads")} className="mt-3 w-full max-w-[560px] h-10 px-3 rounded-md border border-dashed border-btn-edge text-muted hover:text-ink flex items-center gap-2 text-left">
      <MagnifyingGlass size={15} /><span className="flex-1">Search another niche or location</span><span className="tag">5/5 trial leads used</span><LockSimple size={13} />
    </button>
  );
}

// Branding stamped on every PDF: logo, colour, contact. Stored on the widget record (shared with the widget).
function Branding() {
  const s = useApp();
  const g = useGrowth();
  const w = g.widget;
  const [f, setF] = useState({ logo_url: w?.logo_url ?? "", brand_color: w?.brand_color ?? "#5f86e0", contact_name: w?.contact_name ?? s.user?.full_name ?? "", contact_email: w?.contact_email ?? s.user?.email ?? "", contact_phone: w?.contact_phone ?? "", booking_url: w?.booking_url ?? "" });
  const [busy, setBusy] = useState(false);
  const canEdit = s.role !== "member";
  return (
    <Section title="Branding on your PDFs" sub="Your logo, colour and contact details go on every audit you send. Your prospects never see Partner AEO.">
      <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[980px]" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await g.saveWidget({ ...f, logo_url: f.logo_url.trim() || null, booking_url: f.booking_url.trim() || null, contact_phone: f.contact_phone.trim() || null, sender_name: s.agency!.name, ...(w ? {} : { enabled: !isTrial(s.agency) }) });
          s.toast("Branding saved");
        } catch (e2) { s.toast((e2 as Error).message, { tone: "error" }); } finally { setBusy(false); }
      }}>
        <Field label="Logo URL (PNG or JPG)" htmlFor="b-logo"><input id="b-logo" className="input" placeholder="Leave blank to use your site icon" value={f.logo_url} disabled={!canEdit} onChange={(e) => setF({ ...f, logo_url: e.target.value })} /></Field>
        <Field label="Brand colour" htmlFor="b-col"><span className="flex gap-2"><input id="b-col" type="color" className="h-9 w-12 rounded-md border border-hairline bg-surface cursor-pointer" value={f.brand_color} disabled={!canEdit} onChange={(e) => setF({ ...f, brand_color: e.target.value })} /><input className="input flex-1" value={f.brand_color} disabled={!canEdit} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setF({ ...f, brand_color: e.target.value })} aria-label="Hex colour" /></span></Field>
        <Field label="Contact name" htmlFor="b-cn"><input id="b-cn" className="input" value={f.contact_name} disabled={!canEdit} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
        <Field label="Contact email" htmlFor="b-ce"><input id="b-ce" type="email" className="input" value={f.contact_email} disabled={!canEdit} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="b-cp"><input id="b-cp" className="input" value={f.contact_phone} disabled={!canEdit} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></Field>
        <Field label="Booking link (Calendly etc.)" htmlFor="b-cb"><input id="b-cb" className="input" placeholder="https://calendly.com/you" value={f.booking_url} disabled={!canEdit} onChange={(e) => setF({ ...f, booking_url: e.target.value })} /></Field>
        {canEdit && <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" variant="primary" loading={busy} disabled={!/^#[0-9a-f]{6}$/i.test(f.brand_color)}>Save branding</Button></div>}
      </form>
    </Section>
  );
}

const PAID: { f: Feature; Icon: typeof Lightning; t: string; b: string }[] = [
  { f: "deck", Icon: PresentationChart, t: "Pitch decks", b: "An editable closing deck for every lead, with a slide-by-slide script." },
  { f: "blueprint", Icon: Lightning, t: "Fulfilment blueprint", b: "25 buyer prompts with search volume, and the pages to win citations on." },
  { f: "fixes", Icon: Wrench, t: "Day-1 fixes", b: "robots.txt rules, /llms.txt, schema and Q&A blocks, ready to paste." },
  { f: "widget", Icon: Code, t: "Lead widget", b: "The scanner on your website, capturing prospects for you." },
];

function Paywalled() {
  const s = useApp();
  const show = useUpgrade((u) => u.show);
  if (!isTrial(s.agency)) return null;
  return (
    <Section title="On paid plans" sub="Everything you need to turn these audits into signed retainers.">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {PAID.map(({ f, Icon, t, b }) => (
          <button key={f} onClick={() => show(f)} className="card p-4 text-left hover:border-btn-edge transition-colors flex flex-col gap-2 opacity-90">
            <span className="flex items-center justify-between"><Icon size={18} className="text-muted" /><LockSimple size={13} className="text-faint" /></span>
            <span className="text-ink font-medium">{t}</span>
            <span className="text-muted">{b}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
