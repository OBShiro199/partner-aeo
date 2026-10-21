"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ ["--d" as string]: `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

// Hand-drawn strokes. Each path draws itself when scrolled into view.
type ScribbleKind = "underline" | "circle" | "arrow-down-right" | "arrow-left" | "arrow-curl" | "squiggle" | "sparkle";

const PATHS: Record<ScribbleKind, { vb: string; d: string[]; len: number[] }> = {
  underline: { vb: "0 0 300 20", d: ["M4 14 C 60 6, 140 4, 200 8 S 280 13, 296 7"], len: [320] },
  circle: { vb: "0 0 220 80", d: ["M120 6 C 40 2, 6 22, 10 44 C 14 70, 90 78, 150 72 C 205 66, 218 40, 200 22 C 182 6, 120 4, 70 12"], len: [620] },
  "arrow-down-right": { vb: "0 0 120 90", d: ["M6 8 C 30 10, 70 22, 92 70", "M74 62 L 93 72 L 100 50"], len: [140, 50] },
  "arrow-left": { vb: "0 0 110 60", d: ["M104 10 C 80 6, 40 14, 12 40", "M10 22 L 11 42 L 32 44"], len: [130, 50] },
  "arrow-curl": { vb: "0 0 140 110", d: ["M8 10 C 60 0, 110 20, 96 50 C 86 70, 52 62, 62 44 C 72 26, 120 50, 118 96", "M104 86 L 118 98 L 130 82"], len: [320, 50] },
  squiggle: { vb: "0 0 160 24", d: ["M4 14 Q 18 2, 32 14 T 60 14 T 88 14 T 116 14 T 144 14 T 158 12"], len: [200] },
  sparkle: { vb: "0 0 40 40", d: ["M20 4 L 20 14", "M20 26 L 20 36", "M4 20 L 14 20", "M26 20 L 36 20"], len: [12, 12, 12, 12] },
};

export function Scribble({ kind, className = "", style, color = "var(--blue)", width = 1.8, delay = 0 }: { kind: ScribbleKind; className?: string; style?: CSSProperties; color?: string; width?: number; delay?: number }) {
  const [ref, inView] = useInView<SVGSVGElement>(0.4);
  const p = PATHS[kind];
  return (
    <svg ref={ref} viewBox={p.vb} className={`scribble ${inView ? "in" : ""} ${className}`} style={style} fill="none" aria-hidden preserveAspectRatio="none">
      {p.d.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          style={{ ["--len" as string]: p.len[i], ["--delay" as string]: `${delay + i * 380}ms` } as CSSProperties} />
      ))}
    </svg>
  );
}

export function Counter({ to, duration = 1400, prefix = "", suffix = "", decimals = 0 }: { to: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(to);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return <span ref={ref} className="tnum">{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

export function Marquee({ children, speed = 40, reverse = false }: { children: ReactNode; speed?: number; reverse?: boolean }) {
  return (
    <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)" }}>
      <div className="flex w-max hover:[animation-play-state:paused]" style={{ animation: `marquee ${speed}s linear infinite`, animationDirection: reverse ? "reverse" : "normal" }}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}
