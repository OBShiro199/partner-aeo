"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/store";
import { cx } from "./ui";

type Step = { target: string; title: string; body: string; side?: "right" | "bottom" | "left" | "top" };

export const TOUR: Step[] = [
  { target: "agency", title: "Your agency workspace", body: "Your name and logo come from your website. Everything here is private to your team.", side: "right" },
  { target: "add-client", title: "Add a client in under a minute", body: "Paste their domain. We read the site, Claude Haiku writes up to 10 prompts, and tracking starts.", side: "right" },
  { target: "client-filter", title: "Filter by client", body: "Every number on this page follows this filter. Pick one client, or see the whole book at once.", side: "bottom" },
  { target: "kpis", title: "The four numbers that matter", body: "Visibility score, how often AI mentions the brand, how often it cites their site, and average rank in lists.", side: "bottom" },
  { target: "engines", title: "Engine by engine", body: "See which assistant recommends your clients and which one ignores them.", side: "top" },
  { target: "clients-table", title: "Your whole book", body: "Sort clients by visibility or change. Open one to see every prompt and every answer.", side: "top" },
  { target: "nav-lab", title: "Test one query at a time", body: "Send a single prompt to a single engine and read the raw answer. Budget-capped so testing never runs away.", side: "right" },
];

const PAD = 6;

export function Tour({ open, onDone }: { open: boolean; onDone: (skipped: boolean) => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = TOUR;
  const step = steps[i];

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step?.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight - 40) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => setRect(el.getBoundingClientRect()), 350);
    } else setRect(r);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone(true);
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Skip steps whose target isn't on screen (e.g. sidebar collapsed).
  useEffect(() => {
    if (open && step && !document.querySelector(`[data-tour="${step.target}"]`)) next();
  });

  function next() {
    if (i >= steps.length - 1) onDone(false);
    else setI(i + 1);
  }

  if (!open || !step) return null;

  const r = rect;
  const W = 300;
  let top = 0, left = 0, arrow: "left" | "top" | "bottom" | "right" = "left";
  if (r) {
    const side = step.side ?? "right";
    if (side === "right") { top = r.top + r.height / 2 - 70; left = r.right + 36; arrow = "left"; }
    if (side === "left") { top = r.top + r.height / 2 - 70; left = r.left - W - 36; arrow = "right"; }
    if (side === "bottom") { top = r.bottom + 34; left = r.left + Math.min(r.width / 2, 120) - 40; arrow = "top"; }
    if (side === "top") { top = r.top - 196; left = r.left + 40; arrow = "bottom"; }
    left = Math.max(12, Math.min(left, window.innerWidth - W - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - 200));
  }

  return createPortal(
    <div className="fixed inset-0 z-[105]" aria-live="polite">
      {/* Spotlight */}
      {r && (
        <div
          className="fixed rounded-[8px] pointer-events-none"
          style={{
            top: 0, left: 0, width: r.width + PAD * 2, height: r.height + PAD * 2,
            transform: `translate(${r.left - PAD}px, ${r.top - PAD}px)`,
            boxShadow: "0 0 0 9999px rgba(8,9,10,.22), 0 0 0 1px var(--blue-edge), 0 0 0 4px rgba(95,134,224,.18)",
            transition: "transform 360ms var(--ease-morph), width 360ms var(--ease-morph), height 360ms var(--ease-morph)",
          }}
        >
          <span className="absolute -inset-1 rounded-[10px] border border-blue" style={{ animation: "ping 1.6s var(--ease-out) infinite" }} />
        </div>
      )}
      <div className="fixed inset-0" onClick={() => onDone(true)} />

      {/* Card */}
      <div
        key={i}
        role="dialog"
        aria-label={step.title}
        className="fixed float p-4 fade-in"
        style={{ top: 0, left: 0, width: W, transform: `translate(${left}px, ${top}px)`, transition: "transform 360ms var(--ease-morph)" }}
      >
        {r && <Scribble dir={arrow} />}
        <div className="flex items-center justify-between mb-2">
          <span className="tag tag-blue tnum">{i + 1} of {steps.length}</span>
          <button className="text-faint hover:text-ink" onClick={() => onDone(true)}>Skip tour</button>
        </div>
        <p className="text-ink font-medium t-14 mb-1">{step.title}</p>
        <p className="text-muted">{step.body}</p>
        <div className="flex items-center gap-1 mt-4">
          {steps.map((_, j) => (
            <span key={j} className={cx("h-1 rounded-full transition-all", j === i ? "w-4 bg-blue" : j < i ? "w-1.5 bg-blue-edge" : "w-1.5 bg-hairline")} />
          ))}
          <div className="ml-auto flex gap-2">
            {i > 0 && <button className="btn btn-compact btn-ghost" onClick={() => setI(i - 1)}>Back</button>}
            <button className="btn btn-compact btn-primary" onClick={next} autoFocus style={{ minWidth: 76 }}>
              {i === steps.length - 1 ? "Finish" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Hand-drawn arrow from the card toward the highlighted element.
function Scribble({ dir }: { dir: "left" | "top" | "bottom" | "right" }) {
  const common = { fill: "none", stroke: "var(--blue)", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (dir === "left") return (
    <svg className="scribble in absolute -left-[38px] top-[30px]" width="40" height="30" aria-hidden>
      <path {...common} d="M38 6 C 26 4, 14 10, 5 20" style={{ ["--len" as string]: 50 }} />
      <path {...common} d="M4 11 L 5 21 L 14 20" style={{ ["--len" as string]: 30, ["--delay" as string]: "300ms" }} />
    </svg>
  );
  if (dir === "right") return (
    <svg className="scribble in absolute -right-[38px] top-[30px]" width="40" height="30" aria-hidden>
      <path {...common} d="M2 6 C 14 4, 26 10, 35 20" style={{ ["--len" as string]: 50 }} />
      <path {...common} d="M36 11 L 35 21 L 26 20" style={{ ["--len" as string]: 30, ["--delay" as string]: "300ms" }} />
    </svg>
  );
  if (dir === "top") return (
    <svg className="scribble in absolute left-[28px] -top-[32px]" width="34" height="34" aria-hidden>
      <path {...common} d="M24 32 C 22 20, 16 12, 7 4" style={{ ["--len" as string]: 50 }} />
      <path {...common} d="M5 13 L 6 3 L 16 4" style={{ ["--len" as string]: 30, ["--delay" as string]: "300ms" }} />
    </svg>
  );
  return (
    <svg className="scribble in absolute left-[28px] -bottom-[32px]" width="34" height="34" aria-hidden>
      <path {...common} d="M24 2 C 22 14, 16 22, 7 30" style={{ ["--len" as string]: 50 }} />
      <path {...common} d="M5 21 L 6 31 L 16 30" style={{ ["--len" as string]: 30, ["--delay" as string]: "300ms" }} />
    </svg>
  );
}

export function useTour() {
  const agency = useApp((s) => s.agency);
  const updateAgency = useApp((s) => s.updateAgency);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (agency && agency.onboarded_at && !agency.tour_completed_at) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, [agency]);
  return {
    open,
    start: () => setOpen(true),
    done: () => { setOpen(false); if (!agency?.tour_completed_at) updateAgency({ tour_completed_at: new Date().toISOString() }).catch(() => {}); },
  };
}
