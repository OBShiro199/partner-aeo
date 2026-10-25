"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowSquareOut, Check, Code, Copy, X as XIcon } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { isDemo } from "@/lib/repo";
import { normaliseDomain, plural } from "@/lib/format";
import type { Widget } from "@/lib/types";
import { Toolbar } from "@/components/shell/Toolbar";
import { RegionSelect } from "@/components/pickers";
import { Button, cx, Empty, Field, Meter } from "@/components/ui";

const SWATCHES = ["#5f86e0", "#2f7d6d", "#7a5af8", "#e0567a", "#d97706", "#0f766e", "#111827"];
const INSTALL = ["HTML", "React", "Webflow", "iframe"] as const;

export default function WidgetPage() {
  const s = useApp();
  const g = useGrowth();
  const canEdit = s.role !== "member";
  const [creating, setCreating] = useState(false);

  if (!g.loaded) return <><Toolbar><span className="text-ink font-medium">Lead widget</span></Toolbar><div className="p-6"><div className="skeleton h-5 w-1/3" /></div></>;

  if (!g.widget) {
    return (
      <>
        <Toolbar><span className="text-ink font-medium">Lead widget</span></Toolbar>
        <Empty
          icon={<Code size={18} />}
          title="Put an AI search scanner on your website"
          body="Prospects enter their domain, a keyword and a competitor. They see their AI Search Score, and to get the full report they leave an email and phone number. The lead lands here with a ready-made pitch."
          action={canEdit
            ? <Button variant="primary" loading={creating} disabled={isDemo} onClick={async () => {
                setCreating(true);
                try {
                  await g.saveWidget({ contact_name: s.user?.full_name || null, contact_email: s.user?.email ?? null, sender_name: s.agency!.name, default_region: s.agency!.regions[0] && s.agency!.regions[0] !== "GLOBAL" ? s.agency!.regions[0] : "GB" });
                  s.toast("Widget created");
                } catch (e) { s.toast((e as Error).message, { tone: "error" }); } finally { setCreating(false); }
              }}>Create my widget</Button>
            : <p className="text-faint">Ask an owner or admin to set it up.</p>}
        />
      </>
    );
  }
  return <Editor key={g.widget.id} widget={g.widget} canEdit={canEdit} />;
}

function Editor({ widget, canEdit }: { widget: Widget; canEdit: boolean }) {
  const s = useApp();
  const g = useGrowth();
  const [w, setW] = useState(widget);
  const [saving, setSaving] = useState(false);
  const [host, setHost] = useState("");
  const [install, setInstall] = useState<(typeof INSTALL)[number]>("HTML");
  const [previewKey, setPreviewKey] = useState(0);
  const [origin, setOrigin] = useState("https://partneraeo.com");
  useEffect(() => setOrigin(location.origin), []);
  const dirty = JSON.stringify(w) !== JSON.stringify(widget);
  const set = <K extends keyof Widget>(k: K, v: Widget[K]) => setW((x) => ({ ...x, [k]: v }));
  const c = g.credits?.widget_scans;
  const leads = g.leads.length;
  const scans = g.audits.filter((a) => a.source === "widget").length;

  async function save() {
    setSaving(true);
    try { await g.saveWidget(w); setPreviewKey((k) => k + 1); s.toast("Widget saved"); }
    catch (e) { s.toast((e as Error).message, { tone: "error" }); }
    finally { setSaving(false); }
  }

  const snippet = useMemo(() => {
    const k = widget.public_key;
    switch (install) {
      case "HTML": return `<div data-partner-aeo="${k}"></div>\n<script async src="${origin}/widget.js"></script>`;
      case "Webflow": return `<!-- Webflow: add an Embed element where the scanner should appear, paste this, then publish. -->\n<div data-partner-aeo="${k}"></div>\n<script async src="${origin}/widget.js"></script>`;
      case "React": return `import { useEffect } from "react";\n\nexport function AeoScanner() {\n  useEffect(() => {\n    const s = document.createElement("script");\n    s.src = "${origin}/widget.js";\n    s.async = true;\n    document.body.appendChild(s);\n    return () => s.remove();\n  }, []);\n  return <div data-partner-aeo="${k}" />;\n}`;
      case "iframe": return `<iframe src="${origin}/embed/${k}" title="AI search scanner" loading="lazy"\n  style="width:100%;max-width:640px;height:720px;border:0"></iframe>`;
    }
  }, [install, origin, widget.public_key]);

  return (
    <>
      <Toolbar right={canEdit && <Button size="compact" variant="primary" disabled={!dirty} loading={saving} onClick={save} minWidth={110}>Save changes</Button>}>
        <span className="text-ink font-medium">Lead widget</span>
        <span className={cx("tag", widget.enabled ? "tag-green" : "")}>{widget.enabled ? "Live" : "Off"}</span>
      </Toolbar>

      <section className="grid md:grid-cols-3 hair-b">
        <div className="p-4 md:p-6 md:hair-r max-md:hair-b">
          <p className="text-faint">Widget scans this month</p>
          <p className="mt-2 mb-3"><span className="text-ink tnum font-medium text-[28px] leading-9">{c?.used ?? 0}</span><span className="text-faint tnum"> of {c?.allowance ?? "–"}</span></p>
          <Meter value={c?.used ?? 0} max={c?.allowance ?? 1} label="Widget scans used" />
          <p className="text-faint mt-2">{g.credits?.overage_enabled && c?.overage_usd ? `Then $${c.overage_usd.toFixed(2)} per scan` : "Scans stop at the limit until next month"}</p>
        </div>
        <div className="p-4 md:p-6 md:hair-r max-md:hair-b">
          <p className="text-faint">Scans run</p>
          <p className="mt-2 text-ink tnum font-medium text-[28px] leading-9">{scans}</p>
          <p className="text-faint mt-2">Repeat scans within 7 days reuse results</p>
        </div>
        <div className="p-4 md:p-6">
          <p className="text-faint">Leads captured</p>
          <p className="mt-2 text-ink tnum font-medium text-[28px] leading-9">{leads}</p>
          <p className="text-faint mt-2">{scans ? `${Math.round((leads / scans) * 100)}% of scans unlocked the report` : "No scans yet"}</p>
        </div>
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="min-w-0 xl:hair-r">
          <Section title="Look and copy" sub="What visitors see on your site.">
            <div className="grid gap-4">
              <Field label="Headline" htmlFor="w-head"><input id="w-head" className="input" maxLength={120} value={w.headline} disabled={!canEdit} onChange={(e) => set("headline", e.target.value)} /></Field>
              <Field label="Subheading" htmlFor="w-sub"><textarea id="w-sub" className="input min-h-[64px] py-2" maxLength={240} value={w.subhead} disabled={!canEdit} onChange={(e) => set("subhead", e.target.value)} /></Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Brand colour" htmlFor="w-color">
                  <div className="flex items-center gap-2 flex-wrap">
                    {SWATCHES.map((sw) => (
                      <button key={sw} type="button" aria-label={sw} disabled={!canEdit} onClick={() => set("brand_color", sw)}
                        className={cx("size-7 rounded-full border-2 transition-transform", w.brand_color.toLowerCase() === sw ? "border-ink scale-110" : "border-transparent")} style={{ background: sw }} />
                    ))}
                    <input id="w-color" type="color" className="size-7 rounded-md border border-hairline cursor-pointer bg-surface" value={w.brand_color} disabled={!canEdit} onChange={(e) => set("brand_color", e.target.value)} aria-label="Custom colour" />
                  </div>
                </Field>
                <Field label="Logo URL" htmlFor="w-logo" hint="PNG or JPG. Leave blank to use your site icon.">
                  <input id="w-logo" className="input" placeholder="https://youragency.com/logo.png" value={w.logo_url ?? ""} disabled={!canEdit} onChange={(e) => set("logo_url", e.target.value.trim() || null)} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="On the prospect's report" sub="The PDF and email go out under your name. Partner AEO never appears.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact name" htmlFor="w-cn"><input id="w-cn" className="input" value={w.contact_name ?? ""} disabled={!canEdit} onChange={(e) => set("contact_name", e.target.value || null)} /></Field>
              <Field label="Email (replies go here)" htmlFor="w-ce"><input id="w-ce" type="email" className="input" value={w.contact_email ?? ""} disabled={!canEdit} onChange={(e) => set("contact_email", e.target.value || null)} /></Field>
              <Field label="Phone" htmlFor="w-cp"><input id="w-cp" className="input" value={w.contact_phone ?? ""} disabled={!canEdit} onChange={(e) => set("contact_phone", e.target.value || null)} /></Field>
              <Field label="Booking link" htmlFor="w-cb" hint="Shown as the call to action."><input id="w-cb" className="input" placeholder="https://cal.com/you" value={w.booking_url ?? ""} disabled={!canEdit} onChange={(e) => set("booking_url", e.target.value.trim() || null)} /></Field>
              <Field label="Email sender name" htmlFor="w-sn"><input id="w-sn" className="input" placeholder={s.agency!.name} value={w.sender_name ?? ""} disabled={!canEdit} onChange={(e) => set("sender_name", e.target.value || null)} /></Field>
              <Field label="Default market" htmlFor="w-region"><RegionSelect id="w-region" value={w.default_region} onChange={(v) => set("default_region", v)} /></Field>
            </div>
          </Section>

          <Section title="Where it can run" sub="Leave empty to allow any site. Add your domains to stop others embedding your key.">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {w.allowed_hosts.map((h) => (
                <span key={h} className="chip h-7">{h}{canEdit && <button aria-label={`Remove ${h}`} onClick={() => set("allowed_hosts", w.allowed_hosts.filter((x) => x !== h))} className="text-faint hover:text-ink"><XIcon size={12} /></button>}</span>
              ))}
              {!w.allowed_hosts.length && <span className="text-faint">Any website</span>}
            </div>
            {canEdit && (
              <form className="flex gap-2 max-w-[420px]" onSubmit={(e) => { e.preventDefault(); const d = normaliseDomain(host); if (d && !w.allowed_hosts.includes(d)) set("allowed_hosts", [...w.allowed_hosts, d]); setHost(""); }}>
                <input className="input flex-1" placeholder="youragency.com" value={host} onChange={(e) => setHost(e.target.value)} aria-label="Allowed domain" />
                <Button type="submit">Add</Button>
              </form>
            )}
            <label className="flex items-center gap-3 mt-5 cursor-pointer w-fit">
              <input type="checkbox" className="check" checked={w.enabled} disabled={!canEdit} onChange={(e) => set("enabled", e.target.checked)} />
              <span className="text-ink">Widget is live</span>
            </label>
          </Section>

          <Section title="Install" sub="Paste once. Changes you save here show up on your site straight away.">
            <div className="flex gap-1 mb-3">
              {INSTALL.map((t) => <button key={t} className="chip h-7" aria-pressed={install === t} onClick={() => setInstall(t)}>{t}</button>)}
            </div>
            <CodeBlock code={snippet} />
            <p className="text-faint mt-3">Public key <code className="text-muted">{widget.public_key}</code>. It only identifies your widget; it can&apos;t read your data.</p>
          </Section>
        </div>

        <aside className="p-4 md:p-6 xl:sticky xl:top-[48px] xl:self-start">
          <div className="flex items-center justify-between mb-3">
            <p className="text-ink font-medium">Preview {dirty && <span className="text-faint font-normal">· save to update</span>}</p>
            <a className="btn btn-ghost btn-compact" href={`/embed/${widget.public_key}`} target="_blank" rel="noreferrer"><ArrowSquareOut size={14} /> Open</a>
          </div>
          <div className="card overflow-hidden dots-bg p-3">
            <iframe key={previewKey} src={`/embed/${widget.public_key}?preview=1`} title="Widget preview" className="w-full h-[640px] rounded-md bg-surface border border-hairline" />
          </div>
          <p className="text-faint mt-2">A scan from the preview is real: it uses a widget credit.</p>
          <p className="text-faint mt-1">{plural(c?.allowance ?? 0, "scan")} included on the {g.credits?.plan ?? "trial"} plan.</p>
        </aside>
      </div>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="p-4 md:p-6 hair-b">
      <h2 className="t-14 font-medium text-ink">{title}</h2>
      <p className="text-faint mt-0.5 mb-4">{sub}</p>
      {children}
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card relative">
      <pre className="p-4 pr-24 overflow-x-auto t-12 leading-5 text-body font-mono whitespace-pre">{code}</pre>
      <button className="btn btn-compact absolute top-2 right-2" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
      </button>
    </div>
  );
}
