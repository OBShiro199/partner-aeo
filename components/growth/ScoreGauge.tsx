"use client";
import { useEffect, useState } from "react";

// Half-dial 0-100 that sweeps up to the score and counts with it.
export function ScoreGauge({ value, color = "var(--blue)", size = 240, label = "AI Search Score" }: { value: number | null; color?: string; size?: number; label?: string }) {
  const shown = useCountUp(value ?? 0, 1400);
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const arc = Math.PI * r;
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = Math.PI - (i / 20) * Math.PI;
    const r1 = r + 9, r2 = r + (i % 5 === 0 ? 3 : 6);
    return { x1: cx + r1 * Math.cos(a), y1: cy - r1 * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy - r2 * Math.sin(a), major: i % 5 === 0 };
  });
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 26 }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} aria-hidden>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)} x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)} stroke={t.major ? "var(--faint)" : "var(--hairline)"} strokeWidth="1" />
        ))}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--hover)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={arc} strokeDashoffset={arc * (1 - shown / 100)} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-ink font-medium tnum tracking-[-0.05em]" style={{ fontSize: size / 4.4, lineHeight: 1 }}>{Math.round(shown)}</span>
        <span className="text-faint mt-1.5">{label}</span>
      </div>
      <span className="sr-only">{label}: {value ?? "unknown"} out of 100</span>
    </div>
  );
}

export function useCountUp(target: number, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
