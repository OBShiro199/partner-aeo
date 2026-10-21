import { Fragment } from "react";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Renders an engine answer as plain React text (never HTML), with the brand highlighted and competitors underlined.
export function AnswerText({ text, brand, competitors }: { text: string; brand: string[]; competitors: string[] }) {
  const terms = [...brand.map((t) => ({ t, k: "b" })), ...competitors.map((t) => ({ t, k: "c" }))].filter((x) => x.t.length > 1);
  const re = terms.length ? new RegExp(`(${terms.map((x) => escape(x.t)).join("|")})`, "gi") : null;
  const kind = (s: string) => terms.find((x) => x.t.toLowerCase() === s.toLowerCase())?.k;

  const inline = (line: string, key: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => {
      const bold = /^\*\*[^*]+\*\*$/.test(p);
      const raw = bold ? p.slice(2, -2) : p;
      const pieces = re ? raw.split(re) : [raw];
      const content = pieces.map((x, j) => {
        const k = kind(x);
        if (k === "b") return <span key={j} className="bg-blue-soft text-blue-ink rounded-[3px] px-0.5 font-medium" style={{ boxShadow: "inset 0 0 0 1px var(--blue-edge)" }}>{x}</span>;
        if (k === "c") return <span key={j} className="underline decoration-warning decoration-[1.5px] underline-offset-2">{x}</span>;
        return <Fragment key={j}>{x}</Fragment>;
      });
      return bold ? <strong key={key + i} className="font-medium text-ink">{content}</strong> : <Fragment key={key + i}>{content}</Fragment>;
    });
  };

  return (
    <div className="flex flex-col gap-1.5 text-body t-14 leading-[22px] max-w-[68ch]">
      {text.split(/\n/).map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const h = line.match(/^#{1,4}\s+(.*)/);
        if (h) return <p key={i} className="text-ink font-medium mt-2">{inline(h[1], `h${i}`)}</p>;
        const li = line.match(/^\s*(\d+[.)]|[-*•])\s+(.*)/);
        if (li) return <p key={i} className="pl-6 relative"><span className="absolute left-0 text-faint tnum">{/\d/.test(li[1]) ? li[1] : "·"}</span>{inline(li[2], `l${i}`)}</p>;
        return <p key={i}>{inline(line, `p${i}`)}</p>;
      })}
    </div>
  );
}
