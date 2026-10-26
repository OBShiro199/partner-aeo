"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Plus, Minus, Buildings, Sparkle, ChartLineUp, Quotes, UsersThree, Flask, Globe, ShieldCheck, Lightning, Code, Tray, PresentationChart, LockSimple } from "@phosphor-icons/react";
import { ENGINES, EngineLogo } from "@/lib/engines";
import { repo } from "@/lib/repo";
import { FlagIcon } from "@/lib/regions";
import { Wordmark } from "../brand";
import { cx } from "../ui";
import { Counter, Marquee, Reveal, Scribble } from "./motion";
import { HeroMock } from "./HeroMock";
import { ScoreGauge } from "../growth/ScoreGauge";

const RAIL = "mx-auto w-full max-w-[1180px] border-x border-hairline";

export function Landing() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { repo.currentUser().then((u) => setAuthed(!!u)).catch(() => {}); }, []);
  const cta = authed ? { href: "/dashboard", label: "Open dashboard" } : { href: "/signup", label: "Start free trial" };

  return (
    <div className="bg-surface text-body overflow-x-clip">
      <Nav cta={cta} />
      <Hero cta={cta} />
      <EngineStrip />
      <HowItWorks />
      <FeatureCarousel />
      <Numbers />
      <LeadEngine />
      <Tenancy />
      <Pricing cta={cta} />
      <Faq />
      <Closing cta={cta} />
      <Footer />
    </div>
  );
}

function Nav({ cta }: { cta: { href: string; label: string } }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={cx("sticky top-0 z-[90] bg-surface/85 backdrop-blur transition-colors", scrolled ? "hair-b" : "border-b border-transparent")}>
      <div className={cx(RAIL, "h-14 flex items-center gap-6 px-4 sm:px-6")}>
        <Link href="/" aria-label="Partner AEO home"><Wordmark /></Link>
        <nav className="hidden md:flex items-center gap-5 text-muted">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Product</a>
          <a href="#leads" className="hover:text-ink">Win clients</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">Log in</Link>
          <Link href={cta.href} className="btn btn-primary">{cta.label}</Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ cta }: { cta: { href: string; label: string } }) {
  return (
    <section className="relative">
      <div className="absolute inset-0 grid-bg" style={{ maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 35%, transparent 80%)" }} aria-hidden />
      <Pulses />
      <div className={cx(RAIL, "relative px-4 sm:px-6 pt-16 sm:pt-24 pb-28 sm:pb-36")}>
        <div className="max-w-[760px] mx-auto text-center flex flex-col items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-full border border-hairline bg-surface text-muted" style={{ boxShadow: "0 1px 2px rgba(8,9,10,.04)" }}>
              <span className="flex -space-x-1">
                {ENGINES.slice(0, 4).map((e) => <span key={e.id} className="size-5 rounded-full bg-surface grid place-items-center" style={{ boxShadow: "0 0 0 1px var(--hairline)" }}><EngineLogo id={e.id} size={11} /></span>)}
              </span>
              <span className="live-dot green" style={{ width: 6, height: 6 }} />
              Live on ChatGPT, Gemini, Claude and Perplexity
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="h-display mt-7">
              Know which of your clients{" "}
              <span className="relative inline-block whitespace-nowrap">
                AI recommends
                <Scribble kind="underline" className="absolute left-0 -bottom-2 w-full h-4" delay={700} width={2.4} />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="t-16 text-muted mt-6 max-w-[580px]">
              Partner AEO is the answer engine workspace for agencies. Add every client, track the prompts their buyers ask AI, and show exactly where each brand is named, ranked and cited.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              <Link href={cta.href} className="btn btn-primary btn-large">{cta.label} <ArrowRight size={15} /></Link>
              <a href="#how" className="btn btn-large">See how it works</a>
            </div>
            <p className="text-faint mt-4">14-day trial · 3 seats included · No card needed</p>
          </Reveal>
        </div>

        <Reveal delay={320} className="relative mt-16 sm:mt-20 max-w-[920px] mx-auto">
          <div className="hidden lg:block absolute -left-44 top-6 w-40 text-right">
            <p className="text-ink font-medium">Every client, one screen</p>
            <p className="text-faint">Filter the whole book in a click</p>
            <Scribble kind="arrow-down-right" className="w-28 h-20 ml-auto mt-1" delay={900} />
          </div>
          <div className="hidden lg:block absolute -right-48 top-[14%] w-40">
            <Scribble kind="arrow-left" className="w-24 h-12 -ml-2 mb-1" delay={1300} />
            <p className="text-ink font-medium">The real answer</p>
            <p className="text-faint">Brand highlighted, rank and sources</p>
          </div>
          <HeroMock />
        </Reveal>
      </div>
    </section>
  );
}

// Soft concentric pulses behind the hero.
function Pulses() {
  return (
    <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-edge"
          style={{ width: 520, height: 520, animation: `ping 6s var(--ease-out) ${i * 2}s infinite`, opacity: 0 }} />
      ))}
    </div>
  );
}

function EngineStrip() {
  return (
    <section className="hair-t hair-b">
      <div className={cx(RAIL, "py-8")}>
        <p className="text-center text-faint mb-6">Watching the assistants your clients&apos; buyers already use</p>
        <Marquee speed={45}>
          {ENGINES.map((e) => (
            <span key={e.id} className="flex items-center gap-2.5 px-8 h-10">
              <EngineLogo id={e.id} size={20} />
              <span className="text-ink font-medium t-16 tracking-[-0.02em]">{e.name}</span>
              {!e.live && <span className="tag">Soon</span>}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, body, center }: { eyebrow: string; title: React.ReactNode; body?: string; center?: boolean }) {
  return (
    <div className={cx("max-w-[620px]", center && "mx-auto text-center")}>
      <Reveal><p className="text-blue-ink font-medium mb-3 inline-flex items-center gap-2"><span className="live-dot" style={{ width: 6, height: 6 }} />{eyebrow}</p></Reveal>
      <Reveal delay={80}><h2 className="h1">{title}</h2></Reveal>
      {body && <Reveal delay={140}><p className="text-muted t-16 mt-4">{body}</p></Reveal>}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { Icon: Buildings, t: "Set up your agency", b: "Sign up, pick your markets with a flag, choose up to 10 answer engines. Your logo and name come from your site.", tag: "2 minutes" },
    { Icon: UsersThree, t: "Add clients by domain", b: "Paste a list of domains. We read each site and Claude Haiku writes 10 prompts their buyers actually type.", tag: "10 prompts each" },
    { Icon: ChartLineUp, t: "Track, compare, report", b: "Every prompt runs on every engine. See mentions, rank, citations and competitors, for one client or the whole book.", tag: "Weekly scans" },
  ];
  return (
    <section id="how" className="hair-b scroll-mt-14">
      <div className={cx(RAIL, "px-4 sm:px-6 py-20 sm:py-28")}>
        <SectionHead eyebrow="How it works" title={<>From sign-up to a full client book <span className="relative inline-block">in minutes<Scribble kind="circle" className="absolute -left-4 -top-3 w-[calc(100%+32px)] h-[calc(100%+20px)]" delay={300} width={1.6} /></span></>} body="No spreadsheets of prompts, no manual checking in five different chat apps." />
        <div className="relative mt-14 grid md:grid-cols-3 border-t border-hairline">
          <Scribble kind="squiggle" className="hidden md:block absolute left-[30%] -top-3 w-[40%] h-6" color="var(--blue-edge)" />
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 120} className={cx("pt-8 pb-2 md:pr-8", i > 0 && "md:pl-8 md:border-l border-hairline", i > 0 && "max-md:border-t max-md:mt-8")}>
              <div className="flex items-center justify-between mb-6">
                <span className="size-10 rounded-md border border-hairline grid place-items-center relative">
                  <s.Icon size={19} weight="duotone" color="var(--blue)" />
                  <span className="absolute -inset-1 rounded-[9px] border border-blue-edge" style={{ animation: `ping 2.6s var(--ease-out) ${i * 0.6}s infinite`, opacity: 0 }} />
                </span>
                <span className="text-faint tnum">0{i + 1}</span>
              </div>
              <h3 className="h3">{s.t}</h3>
              <p className="text-muted t-14 mt-2">{s.b}</p>
              <span className="tag tag-blue mt-5">{s.tag}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { Icon: UsersThree, t: "Built for many clients", b: "Each agency is its own tenant. Clients, prompts and answers are isolated by row-level security.", demo: "tenants" },
  { Icon: Sparkle, t: "Prompts written for you", b: "Claude Haiku reads each client's site and writes the questions buyers ask. Edit, pause or add your own.", demo: "prompts" },
  { Icon: Quotes, t: "Read the actual answer", b: "Every number links to the answer behind it, with the brand highlighted and competitors underlined.", demo: "answer" },
  { Icon: ChartLineUp, t: "Share of voice", b: "See who AI names instead of your client, and which sources it trusts when it does.", demo: "sov" },
  { Icon: Flask, t: "One-query API lab", b: "Test a single prompt on a single engine and see the exact cost. Hard budget caps keep testing safe.", demo: "lab" },
  { Icon: ShieldCheck, t: "Seats and roles", b: "Owners, admins and members. Seat limits per plan, invites that hold a seat until accepted.", demo: "seats" },
];

function FeatureCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const scroll = (dir: 1 | -1) => {
    const el = track.current!;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 16), behavior: "smooth" });
  };
  useEffect(() => {
    const el = track.current!;
    const on = () => {
      const card = el.querySelector<HTMLElement>("[data-card]");
      setIdx(Math.round(el.scrollLeft / ((card?.offsetWidth ?? 320) + 16)));
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  return (
    <section id="features" className="hair-b scroll-mt-14 relative">
      <div className="absolute inset-0 dots-bg opacity-60" style={{ maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)" }} aria-hidden />
      <div className={cx(RAIL, "relative py-20 sm:py-28")}>
        <div className="px-4 sm:px-6 flex flex-wrap items-end justify-between gap-6">
          <SectionHead eyebrow="Product" title="Everything an agency needs to run AEO for clients" />
          <div className="flex gap-2">
            <button className="btn btn-icon size-10" aria-label="Previous" onClick={() => scroll(-1)} disabled={idx === 0}><ArrowLeft size={16} /></button>
            <button className="btn btn-icon size-10" aria-label="Next" onClick={() => scroll(1)} disabled={idx >= FEATURES.length - 2}><ArrowRight size={16} /></button>
          </div>
        </div>
        <div ref={track} className="mt-12 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar px-4 sm:px-6 scroll-px-4 sm:scroll-px-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 80} className="snap-start shrink-0 w-[300px] sm:w-[360px]">
              <article data-card className="card h-full flex flex-col overflow-hidden group hover:border-btn-edge transition-colors">
                <div className="h-[200px] hair-b relative overflow-hidden grid-bg"><FeatureDemo kind={f.demo} /></div>
                <div className="p-5">
                  <f.Icon size={18} weight="duotone" color="var(--blue)" />
                  <h3 className="t-16 font-medium text-ink mt-3">{f.t}</h3>
                  <p className="text-muted mt-1.5">{f.b}</p>
                </div>
              </article>
            </Reveal>
          ))}
          <div className="shrink-0 w-2" />
        </div>
        <div className="flex justify-center gap-1.5 mt-8">
          {FEATURES.map((_, i) => <span key={i} className={cx("h-1 rounded-full transition-all", i === idx ? "w-5 bg-blue" : "w-1.5 bg-hairline")} />)}
        </div>
      </div>
    </section>
  );
}

function FeatureDemo({ kind }: { kind: string }) {
  if (kind === "tenants") return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative size-[150px]">
        <span className="absolute inset-0 rounded-full border border-dashed border-btn-edge" style={{ animation: "orbit 30s linear infinite" }} />
        <span className="absolute inset-[30px] rounded-full border border-hairline" />
        <span className="absolute inset-[58px] rounded-md border border-blue-edge bg-surface grid place-items-center text-blue-ink font-medium">You</span>
        {["N", "H", "B", "K", "F"].map((l, i) => {
          const a = (i / 5) * Math.PI * 2;
          return <span key={l} className="absolute size-7 rounded-md bg-surface border border-hairline grid place-items-center text-[11px] font-medium text-ink" style={{ left: Math.round(75 + Math.cos(a) * 75 - 14), top: Math.round(75 + Math.sin(a) * 75 - 14), animation: `float-y ${4 + i}s ease-in-out infinite` }}>{l}</span>;
        })}
      </div>
    </div>
  );
  if (kind === "prompts") return (
    <div className="absolute inset-x-5 top-6 flex flex-col gap-2">
      {["Best CRM for small law firms", "How do I stop missing client calls", "Alternatives to Clio for solicitors", "Legal CRM with UK data hosting"].map((t, i) => (
        <div key={t} className="h-8 rounded-md border border-hairline bg-surface flex items-center gap-2 px-2.5 rise" style={{ animationDelay: `${i * 140}ms` }}>
          <span className="size-3.5 rounded-[3px] bg-blue grid place-items-center"><Check size={8} weight="bold" color="#fff" /></span>
          <span className="truncate text-ink t-12">{t}</span>
        </div>
      ))}
      <span className="flex items-center gap-1.5 text-faint t-12 mt-1"><span className="live-dot" style={{ width: 6, height: 6 }} /> Claude Haiku writing</span>
    </div>
  );
  if (kind === "answer") return (
    <div className="absolute inset-x-5 top-6 card p-3 t-12">
      <div className="flex items-center gap-1.5 mb-2"><EngineLogo id="perplexity" size={12} /><span className="text-ink font-medium">Perplexity</span></div>
      <p className="text-body leading-5">For Saturday appointments in Leeds, <span className="bg-blue-soft text-blue-ink rounded-[3px] px-0.5 font-medium">Northgate Dental</span> is well reviewed and open 9 to 2. <span className="underline decoration-warning underline-offset-2">Smile Studio</span> is another option.</p>
      <div className="flex gap-1 mt-2"><span className="tag tag-green">#1</span><span className="tag">3 sources</span></div>
    </div>
  );
  if (kind === "sov") return (
    <div className="absolute inset-x-6 top-8 flex flex-col gap-3.5">
      {[{ n: "Your client", v: 46, b: true }, { n: "Competitor A", v: 31 }, { n: "Competitor B", v: 15 }, { n: "Others", v: 8 }].map((x, i) => (
        <div key={x.n} className="flex items-center gap-3 t-12">
          <span className={cx("w-24 truncate", x.b ? "text-ink font-medium" : "text-muted")}>{x.n}</span>
          <span className="flex-1 h-2 rounded-full bg-hover overflow-hidden"><span className="block h-full rounded-full reveal in" style={{ width: `${x.v * 1.6}%`, background: x.b ? "var(--blue)" : "var(--ghost)", transitionDelay: `${i * 100}ms` }} /></span>
          <span className="tnum text-faint w-8 text-right">{x.v}%</span>
        </div>
      ))}
    </div>
  );
  if (kind === "lab") return (
    <div className="absolute inset-x-5 top-6 flex flex-col gap-2.5">
      <div className="h-9 rounded-md border border-btn-edge bg-surface flex items-center px-2.5 gap-2 t-12"><EngineLogo id="chatgpt" size={13} /><span className="text-ink truncate">best accountant for freelancers</span></div>
      <div className="flex items-center gap-2"><span className="btn btn-primary btn-compact pointer-events-none"><Lightning size={12} weight="fill" className="text-blue" /> Run 1 check</span><span className="flex items-center gap-1.5 text-faint t-12"><span className="live-dot" style={{ width: 6, height: 6 }} />answering</span></div>
      <div className="mt-1"><div className="flex justify-between t-12 mb-1.5"><span className="text-ink tnum">1 of 3 checks</span><span className="text-faint tnum">$0.018</span></div><div className="h-1.5 rounded-full bg-hover"><div className="h-full w-1/3 rounded-full bg-blue" /></div></div>
    </div>
  );
  return (
    <div className="absolute inset-x-6 top-7 flex flex-col">
      {[{ n: "Alex Morgan", r: "Owner" }, { n: "Sam Patel", r: "Admin" }, { n: "jo@agency.com", r: "Invited" }].map((m, i) => (
        <div key={m.n} className="h-11 flex items-center gap-2.5 hair-b border-divider t-12 rise" style={{ animationDelay: `${i * 120}ms` }}>
          <span className={cx("size-6 rounded-full grid place-items-center text-[10px] font-medium", m.r === "Invited" ? "border border-dashed border-btn-edge text-faint" : "bg-hover text-muted")}>{m.n[0].toUpperCase()}</span>
          <span className="flex-1 text-ink truncate">{m.n}</span>
          <span className={cx("tag", m.r === "Owner" && "tag-blue")}>{m.r}</span>
        </div>
      ))}
      <p className="text-faint t-12 mt-3 tnum">3 of 3 seats used</p>
    </div>
  );
}

function Numbers() {
  const stats = [
    { v: 4, s: "", l: "engines live today, 10 on the roadmap" },
    { v: 10, s: "", l: "buyer prompts tracked per client" },
    { v: 40, s: "", l: "answers read per client, every scan" },
    { v: 4.4, s: "", p: "$", d: 1, l: "average API cost per client per month" },
  ];
  return (
    <section className="hair-b relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-70" aria-hidden />
      <div className={cx(RAIL, "relative grid grid-cols-2 lg:grid-cols-4")}>
        {stats.map((x, i) => (
          <Reveal key={x.l} delay={i * 100} className={cx("px-6 py-12 sm:py-16 bg-surface/70 min-w-0", i % 2 === 0 && "hair-r", i === 1 && "lg:hair-r", i < 2 && "max-lg:hair-b")}>
            <p className="text-ink text-[44px] sm:text-[56px] leading-none font-medium tracking-[-0.05em]"><Counter to={x.v} prefix={x.p} decimals={x.d ?? 0} /></p>
            <p className="text-muted mt-3 max-w-[200px]">{x.l}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Tenancy() {
  const flags = ["GB", "US", "IE", "DE", "FR", "NL", "AU", "CA", "ES", "SE"];
  return (
    <section className="hair-b">
      <div className={cx(RAIL, "grid lg:grid-cols-2")}>
        <div className="px-4 sm:px-6 py-20 sm:py-28 lg:hair-r">
          <SectionHead eyebrow="Built to scale" title="One workspace per agency. Every client inside it." body="Prompts are written for each client's market, from London to Austin. Your team sees the whole book; nobody else sees anything." />
          <ul className="mt-8 flex flex-col gap-3">
            {["Row-level security on every table", "Owner, admin and member roles", "Seat and client limits by plan", "Answers stored, never overwritten"].map((t, i) => (
              <Reveal as="li" key={t} delay={i * 80} className="flex items-center gap-3 text-ink">
                <span className="size-5 rounded-full border border-blue-edge bg-blue-soft grid place-items-center"><Check size={10} weight="bold" color="var(--blue)" /></span>{t}
              </Reveal>
            ))}
          </ul>
        </div>
        <div className="relative min-h-[380px] overflow-hidden flex items-center justify-center py-12 min-w-0">
          <div className="absolute inset-0 grid-bg grid-fade" aria-hidden />
          <div className="relative flex flex-col gap-3 w-[min(420px,90%)] min-w-0">
            <Marquee speed={30}>{flags.map((f) => <span key={f} className="mx-2 h-10 px-3 rounded-md border border-hairline bg-surface flex items-center gap-2"><FlagIcon code={f} size={20} /><span className="text-ink tnum">{f}</span></span>)}</Marquee>
            <Marquee speed={36} reverse>{[...flags].reverse().map((f) => <span key={f} className="mx-2 h-10 px-3 rounded-md border border-hairline bg-surface flex items-center gap-2"><FlagIcon code={f} size={20} /><Globe size={13} className="text-faint" /></span>)}</Marquee>
            <Reveal delay={200} className="card p-4 mt-4" >
              <div className="flex items-center gap-2 mb-3"><span className="live-dot green" /><span className="text-ink font-medium">Orbit Digital</span><span className="tag ml-auto tnum">24 clients</span></div>
              <div className="grid grid-cols-3 gap-2 t-12">
                {["Dental", "Legal", "SaaS", "Trades", "Retail", "Health"].map((x) => <span key={x} className="h-8 rounded-md border border-divider grid place-items-center text-muted">{x}</span>)}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { n: "Starter", p: 149, c: "10 clients · 3 seats", f: ["4 live engines", "10 prompts per client", "Lead widget: 50 scans a month", "10 strategy runs a month"] },
  { n: "Growth", p: 349, c: "30 clients · 10 seats", f: ["Everything in Starter", "Lead widget: 200 scans a month", "30 strategy runs a month", "White-label prospect reports"], pop: true },
  { n: "Scale", p: 899, c: "100 clients · 50 seats", f: ["Everything in Growth", "Lead widget: 1,000 scans a month", "Twice-weekly scans", "API access and SSO*"] },
];

// The growth side of the product: the scanner on the agency's own site, and what lands in the dashboard.
function LeadEngine() {
  const steps = [
    { Icon: Code, t: "Paste one line on your site", b: "The scanner runs in your colours, under your name. Prospects enter their site, what they sell and a competitor." },
    { Icon: LockSimple, t: "They see the score, you get the lead", b: "An AI Search Score and how often a rival is recommended instead. The full 3-page report unlocks with an email and phone number." },
    { Icon: PresentationChart, t: "Walk into the call with a pitch", b: "Each lead arrives with 25 buyer prompts and their search volume, the sources to win, a cold email, a call script and an editable deck." },
  ];
  return (
    <section id="leads" className="hair-b scroll-mt-14">
      <div className={cx(RAIL, "grid lg:grid-cols-2")}>
        <div className="px-4 sm:px-6 py-20 sm:py-28 lg:hair-r">
          <SectionHead eyebrow="Win new clients" title="Your website, now an AI search audit that captures leads" body="The same data your clients pay for becomes your best sales tool." />
          <ol className="mt-10 flex flex-col gap-6">
            {steps.map(({ Icon, t, b }, i) => (
              <Reveal as="li" key={t} delay={i * 100} className="flex gap-4">
                <span className="size-9 rounded-md border border-blue-edge bg-blue-soft grid place-items-center flex-none"><Icon size={17} className="text-blue-ink" /></span>
                <span><span className="block text-ink font-medium t-14">{t}</span><span className="block text-muted mt-1">{b}</span></span>
              </Reveal>
            ))}
          </ol>
        </div>
        <div className="relative min-h-[460px] overflow-hidden flex items-center justify-center py-14 min-w-0">
          <div className="absolute inset-0 dots-bg opacity-70" aria-hidden />
          <div className="relative w-[min(400px,90%)] flex flex-col gap-3">
            <Reveal className="card p-5 flex flex-col items-center" >
              <div className="w-full flex items-center gap-2 mb-2"><span className="size-5 rounded-full bg-[#2f7d6d22] text-[#2f7d6d] grid place-items-center text-[10px] font-medium">N</span><span className="text-ink font-medium">Northlight Digital</span><span className="ml-auto flex gap-1">{["chatgpt", "perplexity", "gemini", "claude"].map((e) => <EngineLogo key={e} id={e} size={13} />)}</span></div>
              <ScoreGauge value={34} color="#2f7d6d" size={200} />
              <span className="tag tag-amber mt-2">At risk</span>
              <p className="text-muted text-center mt-3"><span className="text-[var(--danger-ink)] font-medium tnum">66%</span> of answers recommended a competitor instead.</p>
            </Reveal>
            <Reveal delay={250} className="card p-3.5 flex items-center gap-3 ml-8 shadow-[0_8px_24px_rgba(8,9,10,0.06)]">
              <span className="size-8 rounded-md border border-hairline grid place-items-center"><Tray size={15} className="text-blue" /></span>
              <span className="min-w-0 flex-1"><span className="block text-ink font-medium truncate">New lead · brightsmile.co.uk</span><span className="block text-faint t-12">Strategy pack and deck ready</span></span>
              <span className="tag tag-blue">New</span>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing({ cta }: { cta: { href: string; label: string } }) {
  return (
    <section id="pricing" className="hair-b scroll-mt-14">
      <div className={cx(RAIL, "px-4 sm:px-6 py-20 sm:py-28")}>
        <SectionHead center eyebrow="Pricing" title="Priced per agency, not per client" body="Every plan includes every live engine. Start with a 14-day trial." />
        <div className="grid md:grid-cols-3 gap-3 mt-14">
          {PLANS.map((p, i) => (
            <Reveal key={p.n} delay={i * 100}>
              <div className={cx("card p-6 h-full flex flex-col relative", p.pop && "border-blue-edge")}>
                {p.pop && <Scribble kind="sparkle" className="absolute -top-4 -right-4 size-9" delay={600} />}
                <div className="flex items-center justify-between"><p className="text-ink font-medium t-16">{p.n}</p>{p.pop && <span className="tag tag-blue">Most agencies</span>}</div>
                <p className="mt-4"><span className="text-ink text-[40px] leading-none font-medium tracking-[-0.05em] tnum">${p.p}</span><span className="text-faint"> / month</span></p>
                <p className="text-muted mt-2">{p.c}</p>
                <ul className="flex flex-col gap-2.5 mt-6 mb-8">{p.f.map((f) => <li key={f} className="flex items-center gap-2"><Check size={13} weight="bold" className="text-blue" />{f}</li>)}</ul>
                <Link href={cta.href} className={cx("btn mt-auto", p.pop ? "btn-blue" : "")}>{cta.label}</Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="text-faint text-center mt-6">* Coming soon. Prices exclude VAT.</p>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "What is AEO?", a: "Answer engine optimisation: making sure assistants like ChatGPT, Gemini, Claude and Perplexity name and cite a brand when buyers ask them for a recommendation." },
  { q: "Is this what a customer actually sees?", a: "Close to it. We query each engine through its API with web search on, via DataForSEO. That approximates a searching user, but isn't identical to a signed-in consumer session." },
  { q: "How are prompts chosen?", a: "Claude Haiku reads each client's homepage and writes up to 10 prompts across four intents: best-for, problem-led, comparison and local. You can edit, pause or add your own." },
  { q: "What is the lead widget?", a: "A scanner you embed on your own site with one line of code. Visitors see how visible they are in AI search; to get the full white-label report they leave an email and phone number, and the lead lands in your dashboard with a pitch pack." },
  { q: "Can my team share one workspace?", a: "Yes. Each agency is a tenant with seats. Owners and admins manage clients, billing and invites; members work on clients." },
  { q: "What does it cost to run?", a: "Each check costs DataForSEO roughly one to three cents. A client with 10 prompts on 4 engines, scanned weekly, is about $4.40 a month in API fees. That's included in your plan." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="hair-b scroll-mt-14">
      <div className={cx(RAIL, "grid lg:grid-cols-[1fr_1.4fr]")}>
        <div className="px-4 sm:px-6 py-20 sm:py-28 lg:hair-r">
          <SectionHead eyebrow="FAQ" title="Questions agencies ask first" />
          <Scribble kind="arrow-curl" className="hidden lg:block w-32 h-24 mt-10 ml-24" delay={300} />
        </div>
        <div className="px-4 sm:px-6 lg:py-20 pb-16">
          {FAQS.map((f, i) => (
            <div key={f.q} className="hair-b">
              <button className="w-full flex items-center justify-between gap-6 py-5 text-left" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="text-ink font-medium t-16">{f.q}</span>
                <span className="size-7 rounded-md border border-hairline grid place-items-center flex-none text-muted">{open === i ? <Minus size={13} /> : <Plus size={13} />}</span>
              </button>
              <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: open === i ? "1fr" : "0fr", transitionTimingFunction: "var(--ease-morph)" }}>
                <div className="overflow-hidden"><p className="text-muted t-14 pb-5 max-w-[60ch]">{f.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing({ cta }: { cta: { href: string; label: string } }) {
  return (
    <section className="relative hair-b overflow-hidden">
      <div className="absolute inset-0 grid-bg grid-fade" aria-hidden />
      <Pulses />
      <div className={cx(RAIL, "relative px-4 sm:px-6 py-24 sm:py-32 text-center flex flex-col items-center")}>
        <Reveal><h2 className="h-display max-w-[760px]">Find out who AI recommends <span className="relative inline-block">instead<Scribble kind="underline" className="absolute left-0 -bottom-1.5 w-full h-3.5" delay={400} width={2.2} /></span> of your clients</h2></Reveal>
        <Reveal delay={120}><p className="text-muted t-16 mt-6 max-w-[520px]">Set up your agency, add your clients and read the first answers today.</p></Reveal>
        <Reveal delay={200}>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Link href={cta.href} className="btn btn-primary btn-large">{cta.label} <ArrowRight size={15} /></Link>
            <Link href="/login" className="btn btn-large">Log in</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className={cx(RAIL, "grid sm:grid-cols-3")}>
        <div className="p-6 sm:hair-r">
          <Wordmark />
          <p className="text-faint mt-3 max-w-[260px]">The answer engine workspace for agencies.</p>
        </div>
        <div className="p-6 sm:hair-r flex flex-col gap-2 text-muted">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <Link href="/login" className="hover:text-ink">Log in</Link>
        </div>
        <div className="p-6 text-faint">
          Answers come from each engine&apos;s API with web search on, via DataForSEO. They approximate, but aren&apos;t identical to, a signed-in consumer session.
        </div>
      </div>
      <div className={cx(RAIL, "hair-t px-6 h-12 flex items-center text-faint")}>© {new Date().getFullYear()} Partner AEO</div>
    </footer>
  );
}
