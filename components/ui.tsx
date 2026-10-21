"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { faviconFor } from "@/lib/format";

import { cx } from "@/lib/cx";
export { cx };

/* Spinner: waits 200ms before showing, then stays at least 400ms so it never flickers. */
export function useDelayed(active: boolean, delay = 200, min = 400) {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (active) t = setTimeout(() => { shownAt.current = Date.now(); setShow(true); }, delay);
    else if (show) t = setTimeout(() => setShow(false), Math.max(0, min - (Date.now() - shownAt.current)));
    return () => clearTimeout(t);
  }, [active, delay, min, show]);
  return show;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "blue" | "ghost" | "danger";
  size?: "default" | "compact" | "large" | "icon";
  loading?: boolean;
  minWidth?: number;
};

export function Button({ variant = "default", size = "default", loading = false, minWidth, className, children, style, disabled, ...rest }: BtnProps) {
  const spin = useDelayed(loading);
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      data-loading={spin}
      style={{ minWidth, ...style }}
      className={cx("btn", variant !== "default" && `btn-${variant}`, size !== "default" && `btn-${size}`, className)}
    >
      <span className="btn-label inline-flex items-center gap-2">{children}</span>
      <span className="btn-spinner" aria-hidden><span className="spinner" /></span>
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p role="alert" className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Favicon({ src, domain, name, size = 20, className }: { src?: string | null; domain?: string | null; name?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = src || (domain ? faviconFor(domain, 64) : null);
  const letter = (name ?? domain ?? "?").charAt(0).toUpperCase();
  return (
    <span
      className={cx("inline-grid place-items-center overflow-hidden bg-surface flex-none", className)}
      style={{ width: size, height: size, borderRadius: Math.max(4, size * 0.22), boxShadow: "inset 0 0 0 1px var(--hairline)" }}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} style={{ width: size * 0.72, height: size * 0.72, objectFit: "contain" }} />
      ) : (
        <span className="font-medium text-muted" style={{ fontSize: size * 0.48 }}>{letter}</span>
      )}
    </span>
  );
}

export function LiveStatus({ label, tone = "blue" }: { label: string; tone?: "blue" | "green" | "amber" }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted tnum">
      <span className={cx("live-dot", tone !== "blue" && tone)} />
      {label}
    </span>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const left = Math.max(0, max - value);
  const ratio = max ? left / max : 0;
  const color = ratio < 0.05 ? "var(--danger)" : ratio < 0.2 ? "var(--warning)" : "var(--blue)";
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-[6px] rounded-full bg-hover overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: color, transition: "width 500ms var(--ease-morph)" }} />
      </div>
    </div>
  );
}

/* Dialog: portal, opens 10% from the top, morphs height between steps, width constant. */
export function Dialog({ open, onClose, children, width = 520, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; labelledBy?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    if (!open || !inner.current) return;
    const el = inner.current;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => inner.current?.querySelector<HTMLElement>("[autofocus], input, button")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="dialog" style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
        <div className="morph" style={{ height: h }}>
          <div ref={inner}>{children}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" className="btn btn-ghost btn-icon absolute right-3 top-3">
      <X size={16} strokeWidth={1.5} />
    </button>
  );
}

/* Menu rendered in a portal, anchored to its trigger. */
export function Menu({ trigger, children, align = "start", width = 240 }: { trigger: (p: { onClick: () => void; "aria-expanded": boolean }) => ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; width?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchor = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const r = anchor.current!.getBoundingClientRect();
    const left = align === "end" ? r.right - width : r.left;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    const onDoc = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, align, width]);
  return (
    <>
      <span ref={anchor} className="inline-flex">{trigger({ onClick: () => setOpen((v) => !v), "aria-expanded": open })}</span>
      {open && createPortal(
        <div ref={menu} role="menu" className="menu float" style={{ top: pos.top, left: pos.left, width, transformOrigin: align === "end" ? "top right" : "top left" }}>
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="fixed bottom-4 left-4 z-[110] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="toast float flex items-center gap-3 pl-3 pr-1.5 h-10 max-w-[380px]">
          <span className={cx("size-1.5 rounded-full flex-none", t.tone === "error" ? "bg-danger" : "bg-success")} />
          <span className={cx("truncate", t.tone === "error" ? "text-danger-ink" : "text-ink")}>{t.text}</span>
          {t.action && <a href={t.action.href} className="text-blue-ink font-medium whitespace-nowrap">{t.action.label}</a>}
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="btn btn-ghost btn-icon h-7 w-7"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden grid place-items-center text-center px-6 py-16">
      <div className="absolute inset-0 grid-bg grid-fade opacity-80" aria-hidden />
      <div className="relative max-w-[360px] flex flex-col items-center gap-3">
        {icon && <div className="size-10 rounded-md border border-hairline bg-surface grid place-items-center text-muted">{icon}</div>}
        <h3 className="t-14 font-medium text-ink">{title}</h3>
        <p className="text-muted">{body}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 84, height = 24 }: { values: (number | null)[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, x: (i / Math.max(1, values.length - 1)) * (width - 4) + 2 }));
  const known = pts.filter((p) => p.v != null) as { v: number; x: number }[];
  if (known.length < 2) return <span className="text-ghost">–</span>;
  const max = Math.max(...known.map((p) => p.v), 10);
  const min = Math.min(...known.map((p) => p.v), 0);
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = known.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = known[known.length - 1];
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={y(last.v)} r="2.5" fill="var(--blue)" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ghost tnum">–</span>;
  const r = Math.round(value);
  if (r === 0) return <span className="text-faint tnum">±0</span>;
  return <span className={cx("tnum font-medium", r > 0 ? "text-success-ink" : "text-danger-ink")}>{r > 0 ? "+" : ""}{r}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid place-items-center min-w-5 h-5 px-1 rounded-[4px] border border-hairline text-[11px] text-faint font-sans">{children}</kbd>;
}
