"use client";
import { useLayoutEffect, useRef, useState } from "react";

type Point = { label: string; value: number | null; answers?: number };

// Single-series line with a crosshair tooltip. One axis, recessive grid, 2px line.
export function TrendChart({ data, height = 200, suffix = "" }: { data: Point[]; height?: number; suffix?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height, L = 32, R = 12, T = 12, B = 26;
  const vals = data.map((d) => d.value).filter((v): v is number => v != null);
  const max = Math.max(20, Math.ceil(Math.max(...vals, 0) / 20) * 20);
  const x = (i: number) => L + (i / Math.max(1, data.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const pts = data.map((d, i) => (d.value == null ? null : { x: x(i), y: y(d.value), d }));
  const line = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(" ");
  const area = line && `${line} L${pts.filter(Boolean).at(-1)!.x},${H - B} L${pts.find(Boolean)!.x},${H - B} Z`;
  const ticks = [0, max / 2, max];

  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover != null ? data[hover] : null;
  return (
    <div className="relative" ref={box}>
      <svg ref={ref} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-none"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Visibility over time">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--blue)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)" className="tnum">{t}{suffix}</text>
          </g>
        ))}
        {data.map((d, i) => (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--faint)">{d.label}</text>
        ))}
        {area && <path d={area} fill="url(#trend-fill)" />}
        {line && <path d={line} fill="none" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--btn-edge)" vectorEffect="non-scaling-stroke" />}
        {pts.map((p, i) => p && (i === hover || i === pts.length - 1) && (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--blue)" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {h && hover != null && (
        <div className="absolute pointer-events-none float px-2.5 py-1.5 fade-in" style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: `translateX(${hover > data.length / 2 ? "-110%" : "10%"})` }}>
          <p className="text-faint t-12">Week of {h.label}</p>
          <p className="text-ink font-medium tnum">{h.value == null ? "No data" : `${Math.round(h.value)}${suffix}`}{h.answers != null && <span className="text-faint font-normal"> · {h.answers} answers</span>}</p>
        </div>
      )}
    </div>
  );
}

// Horizontal bar. Value 0..1. Rounded data end, anchored at the baseline.
export function Bar({ value, tone = "blue", label }: { value: number | null; tone?: "blue" | "grey"; label?: string }) {
  return (
    <div className="h-2 rounded-full bg-hover overflow-hidden" role="img" aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(value ? 2 : 0, (value ?? 0) * 100)}%`, background: tone === "blue" ? "var(--blue)" : "var(--ghost)", transition: "width 500ms var(--ease-morph)" }} />
    </div>
  );
}

// Visibility ring for a score 0..100.
export function ScoreRing({ value, size = 56 }: { value: number | null; size?: number }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <svg width={size} height={size} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 700ms var(--ease-morph)" }} />
    </svg>
  );
}
