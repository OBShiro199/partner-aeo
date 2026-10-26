"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Code, CreditCard, Flask, GearSix, MagnifyingGlass, Plus, SquaresFour, Strategy, Tray, UsersThree,
} from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";
import { cx, Dialog, Favicon, Kbd, modKey } from "./ui";

type Item = { id: string; group: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; keywords?: string };

// ⌘K / Ctrl+K: jump to any page, client or lead, or start a common action, from anywhere in the app.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const clients = useApp((s) => s.clients);
  const setAddClientOpen = useApp((s) => s.setAddClientOpen);
  const setFilterClient = useApp((s) => s.setFilterClient);
  const leads = useGrowth((g) => g.leads);
  const audits = useGrowth((g) => g.audits);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-command-palette", onOpen); };
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const auditById = new Map(audits.map((a) => [a.id, a]));
    return [
      { id: "add-client", group: "Actions", label: "Add a client", icon: <Plus size={15} />, run: () => setAddClientOpen(true), keywords: "new create" },
      { id: "run-strategy", group: "Actions", label: "Run a strategy analysis", icon: <Strategy size={15} />, run: go("/strategy"), keywords: "audit prospect research" },
      { id: "widget", group: "Actions", label: "Get the widget embed code", icon: <Code size={15} />, run: go("/widget"), keywords: "install snippet script" },
      { id: "p-dash", group: "Pages", label: "Dashboard", icon: <SquaresFour size={15} />, run: () => { setFilterClient(null); router.push("/dashboard"); } },
      { id: "p-clients", group: "Pages", label: "Clients", icon: <UsersThree size={15} />, run: go("/clients") },
      { id: "p-leads", group: "Pages", label: "Leads", icon: <Tray size={15} />, run: go("/leads") },
      { id: "p-strategy", group: "Pages", label: "Strategy Engine", icon: <Strategy size={15} />, run: go("/strategy") },
      { id: "p-lab", group: "Pages", label: "API lab", icon: <Flask size={15} />, run: go("/lab") },
      { id: "p-billing", group: "Pages", label: "Billing", icon: <CreditCard size={15} />, run: go("/billing"), keywords: "plan usage invoice" },
      { id: "p-settings", group: "Pages", label: "Settings", icon: <GearSix size={15} />, run: go("/settings"), keywords: "team invite engines markets notifications" },
      ...clients.map((c) => ({
        id: `c-${c.id}`, group: "Clients", label: c.name, hint: c.domain, keywords: c.domain,
        icon: <Favicon src={c.favicon_url} domain={c.domain} name={c.name} size={16} />, run: go(`/clients/${c.id}`),
      })),
      ...leads.slice(0, 50).map((l) => {
        const a = auditById.get(l.audit_id);
        return {
          id: `l-${l.id}`, group: "Leads", label: l.name || l.email, hint: a?.prospect_domain ?? l.email, keywords: `${l.email} ${a?.prospect_domain ?? ""}`,
          icon: <Favicon domain={a?.prospect_domain} name={a?.prospect_domain ?? l.email} size={16} />, run: go(`/leads/${l.id}`),
        };
      }),
    ];
  }, [router, clients, leads, audits, setAddClientOpen, setFilterClient]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.filter((i) => i.group !== "Leads").slice(0, 14);
    return items
      .map((i) => {
        const hay = `${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`.toLowerCase();
        const at = hay.indexOf(t);
        return { i, score: at < 0 ? -1 : (i.label.toLowerCase().startsWith(t) ? 0 : 1) + at / 100 };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((x) => x.i);
  }, [items, q]);

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => { if (!open) setQ(""); }, [open]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(i: Item | undefined) {
    if (!i) return;
    setOpen(false);
    i.run();
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} width={560} labelledBy="cmdk-label">
      <div onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        if (e.key === "Enter") { e.preventDefault(); choose(shown[active]); }
      }}>
        <label id="cmdk-label" className="flex items-center gap-2.5 h-12 px-4 hair-b">
          <MagnifyingGlass size={16} className="text-faint flex-none" />
          <input className="flex-1 bg-transparent outline-none text-ink t-14 placeholder:text-ghost" placeholder="Jump to a client, lead or page"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" role="combobox" aria-expanded aria-controls="cmdk-list"
            aria-activedescendant={shown[active] ? `cmdk-${shown[active].id}` : undefined} />
          <Kbd>Esc</Kbd>
        </label>
        <div ref={list} id="cmdk-list" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {!shown.length && <p className="px-3 py-6 text-center text-muted">Nothing matches &ldquo;{q}&rdquo;.</p>}
          {shown.map((it, idx) => {
            const head = idx === 0 || shown[idx - 1].group !== it.group ? it.group : null;
            return (
              <div key={it.id}>
                {head && <p className="px-2.5 pt-2.5 pb-1 t-12 text-faint">{head}</p>}
                <button id={`cmdk-${it.id}`} role="option" aria-selected={idx === active} data-index={idx}
                  onMouseMove={() => setActive(idx)} onClick={() => choose(it)}
                  className={cx("w-full h-9 px-2.5 rounded-[4px] flex items-center gap-2.5 text-left", idx === active ? "bg-hover text-ink" : "text-body")}>
                  <span className="w-4 grid place-items-center text-muted flex-none">{it.icon}</span>
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="text-faint truncate t-12">{it.hint}</span>}
                  {idx === active && <ArrowRight size={13} className="ml-auto text-faint flex-none" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="h-9 px-4 hair-t flex items-center gap-3 text-faint t-12">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>{modKey()}</Kbd><Kbd>K</Kbd> anywhere</span>
        </div>
      </div>
    </Dialog>
  );
}
