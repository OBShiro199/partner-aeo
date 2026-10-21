"use client";
import { useEffect, useState } from "react";
import { EngineLogo, engineById } from "@/lib/engines";
import { Counter } from "./motion";

const CLIENTS = [
  { n: "Northgate Dental", c: "#5f86e0", v: 72, d: "+6" },
  { n: "Halden & Rowe Law", c: "#27a644", v: 58, d: "+3" },
  { n: "Brightwater CRM", c: "#d18b0f", v: 44, d: "-2" },
  { n: "Kestrel Facilities", c: "#845ef7", v: 39, d: "+9" },
  { n: "Fernhill Physio", c: "#eb5757", v: 31, d: "+1" },
];

const ANSWERS = [
  { e: "chatgpt", q: "best crm for small law firms", lines: ["Clio: built for legal teams", "Brightwater CRM: simple pricing, UK support", "HubSpot: generous free tier"], hit: 1 },
  { e: "perplexity", q: "dentist open saturdays in leeds", lines: ["Northgate Dental: Sat 9 to 2, 4.9 on Google", "Smile Studio Leeds", "Park Square Dental"], hit: 0 },
  { e: "gemini", q: "facilities management company manchester", lines: ["Mitie", "Kestrel Facilities: SME contracts, 24/7", "OCS Group"], hit: 1 },
  { e: "claude", q: "employment solicitor for startups", lines: ["Halden & Rowe: fixed-fee startup packages", "Lewis Silkin", "Taylor Rose"], hit: 0 },
];

function Line() {
  const pts = [22, 26, 25, 31, 34, 33, 40, 44, 43, 51, 55, 58];
  const W = 320, H = 92;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * W},${H - (v / 70) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[92px] scribble in" preserveAspectRatio="none" aria-hidden>
      {[0.25, 0.5, 0.75].map((y) => <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />)}
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#hm-fill)" style={{ animation: "fade 1.2s 900ms both" }} />
      <defs><linearGradient id="hm-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5f86e0" stopOpacity=".14" /><stop offset="1" stopColor="#5f86e0" stopOpacity="0" /></linearGradient></defs>
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ ["--len" as string]: 520, ["--delay" as string]: "500ms" }} />
    </svg>
  );
}

export function HeroMock() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % ANSWERS.length), 3400);
    return () => clearInterval(t);
  }, []);
  const a = ANSWERS[i];

  return (
    <div className="relative">
      {/* Window */}
      <div className="relative rounded-[10px] bg-surface overflow-hidden" style={{ boxShadow: "0 40px 100px -20px rgba(8,9,10,.16), 0 0 0 1px rgba(8,9,10,.07)" }}>
        <div className="h-9 flex items-center gap-1.5 px-3 hair-b">
          <span className="size-2.5 rounded-full border border-hairline" /><span className="size-2.5 rounded-full border border-hairline" /><span className="size-2.5 rounded-full border border-hairline" />
          <span className="mx-auto h-5 px-3 rounded-[4px] border border-divider text-faint t-12 flex items-center">app.partneraeo.com/dashboard</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[170px_1fr] text-[12px]">
          <aside className="hair-r p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-2 h-7 px-1.5 mb-1">
              <span className="size-[18px] rounded-[5px] border border-hairline grid place-items-center text-[10px] font-medium text-ink">O</span>
              <span className="text-ink font-medium truncate">Orbit Digital</span>
            </div>
            <div className="h-7 rounded-md border border-btn-edge flex items-center gap-1.5 px-2 text-ink font-medium"><span className="text-blue">+</span> Add client</div>
            <div className="h-7 rounded-md bg-blue-soft flex items-center px-2 text-ink mt-1">Dashboard</div>
            <div className="h-7 flex items-center px-2 text-muted">Clients</div>
            <div className="h-7 flex items-center px-2 text-muted">Billing</div>
            <p className="text-faint px-2 mt-2 mb-0.5">Clients</p>
            {CLIENTS.map((c, k) => (
              <div key={c.n} className="h-6 flex items-center gap-2 px-2 text-muted rise" style={{ animationDelay: `${300 + k * 60}ms` }}>
                <span className="size-3.5 rounded-[3px] grid place-items-center text-[8px] font-medium" style={{ boxShadow: `inset 0 0 0 1px ${c.c}55`, color: c.c }}>{c.n[0]}</span>
                <span className="truncate">{c.n}</span>
              </div>
            ))}
          </aside>
          <div className="min-w-0">
            <div className="grid grid-cols-3 hair-b">
              {[{ l: "Visibility", v: 54, s: "" }, { l: "Mentions", v: 61, s: "%" }, { l: "Citations", v: 23, s: "%" }].map((k, j) => (
                <div key={k.l} className={`p-3 ${j < 2 ? "hair-r" : ""}`}>
                  <p className="text-faint">{k.l}</p>
                  <p className="text-ink font-medium text-[22px] leading-7 tracking-[-0.04em]"><Counter to={k.v} suffix={k.s} /></p>
                </div>
              ))}
            </div>
            <div className="p-3 hair-b">
              <div className="flex items-center justify-between mb-1"><span className="text-ink font-medium">Visibility over time</span><span className="flex items-center gap-1.5 text-faint"><span className="live-dot green" style={{ width: 6, height: 6 }} />Live</span></div>
              <Line />
            </div>
            <div>
              {CLIENTS.slice(0, 4).map((c, k) => (
                <div key={c.n} className="h-8 px-3 flex items-center gap-2 hair-b border-divider rise" style={{ animationDelay: `${700 + k * 90}ms` }}>
                  <span className="text-ink truncate flex-1">{c.n}</span>
                  <span className="w-14 h-1.5 rounded-full bg-hover overflow-hidden"><span className="block h-full rounded-full bg-blue" style={{ width: `${c.v}%`, transition: "width 1s" }} /></span>
                  <span className="tnum text-ink w-5 text-right">{c.v}</span>
                  <span className={`tnum w-6 text-right ${c.d.startsWith("-") ? "text-danger-ink" : "text-success-ink"}`}>{c.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating answer card, cycles through engines */}
      <div className="absolute -right-3 sm:-right-10 -bottom-10 w-[260px] sm:w-[290px] float p-3.5" style={{ animation: "float-y 6s ease-in-out infinite" }}>
        <div key={i} className="fade-in">
          <div className="flex items-center gap-2 mb-2">
            <EngineLogo id={a.e} size={14} />
            <span className="text-ink font-medium">{engineById(a.e)?.name}</span>
            <span className="ml-auto flex items-center gap-1.5 text-faint t-12"><span className="live-dot" style={{ width: 6, height: 6 }} />answering</span>
          </div>
          <p className="text-faint t-12 mb-2 truncate">“{a.q}”</p>
          <ol className="flex flex-col gap-1">
            {a.lines.map((l, k) => (
              <li key={l} className="flex gap-2 t-12 rise" style={{ animationDelay: `${k * 120}ms` }}>
                <span className="text-faint tnum">{k + 1}.</span>
                <span className={k === a.hit ? "text-blue-ink font-medium bg-blue-soft rounded-[3px] px-1 -mx-1" : "text-body"}>{l}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 hair-t border-divider">
            <span className="tag tag-green">Mentioned · #{a.hit + 1}</span>
            <span className="tag">Site cited</span>
          </div>
        </div>
      </div>

      {/* Floating chip */}
      <div className="hidden sm:flex absolute -left-10 top-[62%] float h-9 px-3 items-center gap-2" style={{ animation: "float-y 7s ease-in-out -2s infinite" }}>
        <span className="flex -space-x-1">{["chatgpt", "gemini", "claude", "perplexity"].map((e) => <span key={e} className="size-5 rounded-full bg-surface grid place-items-center" style={{ boxShadow: "0 0 0 1px var(--hairline)" }}><EngineLogo id={e} size={11} /></span>)}</span>
        <span className="text-ink font-medium t-12">160 answers checked</span>
      </div>
    </div>
  );
}
