import type { Outcome as O } from "@/lib/stats";

const STYLE: Record<O, { bg: string; ring: string; label: string }> = {
  win: { bg: "var(--success)", ring: "rgba(39,166,68,.18)", label: "Mentioned near the top" },
  partial: { bg: "var(--warning)", ring: "rgba(209,139,15,.18)", label: "Mentioned lower down, or site cited" },
  loss: { bg: "var(--surface)", ring: "rgba(235,87,87,.0)", label: "Not mentioned" },
  failed: { bg: "var(--surface)", ring: "transparent", label: "Engine didn't answer" },
  pending: { bg: "var(--surface)", ring: "transparent", label: "Not checked yet" },
};

// Small outcome mark. Losses are an outlined red ring, never a filled block.
export function Outcome({ outcome, position = null }: { outcome: O; position?: number | null }) {
  const s = STYLE[outcome];
  const border = outcome === "loss" ? "1.5px solid var(--danger)" : outcome === "pending" ? "1px dashed var(--ghost)" : outcome === "failed" ? "1px solid var(--ghost)" : "none";
  return (
    <span title={s.label + (position ? ` · #${position}` : "")} aria-label={s.label} className="relative inline-grid place-items-center size-[18px]">
      <span className="size-[10px] rounded-full" style={{ background: s.bg, border, boxShadow: `0 0 0 3px ${s.ring}` }} />
      {outcome === "failed" && <span className="absolute text-[9px] text-faint">×</span>}
    </span>
  );
}
