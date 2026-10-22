"use client";
import { useMemo, useState } from "react";
import { Check, CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { REGIONS, FlagIcon, regionByCode } from "@/lib/regions";
import { ENGINES, EngineLogo, MAX_ENGINES } from "@/lib/engines";
import { cx, Menu } from "./ui";

export function RegionSelect({ value, onChange, options, id }: { value: string; onChange: (code: string) => void; options?: string[]; id?: string }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const base = options?.length ? REGIONS.filter((r) => options.includes(r.code)).concat(REGIONS.filter((r) => !options.includes(r.code))) : REGIONS;
    return base.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  }, [q, options]);
  const cur = regionByCode(value);
  return (
    <Menu
      width={280}
      trigger={(p) => (
        <button id={id} type="button" {...p} className="input flex items-center gap-2 text-left">
          <FlagIcon code={value} />
          <span className="flex-1 truncate text-ink">{cur?.name ?? "Choose a market"}</span>
          <CaretDown size={14} className="text-faint" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="relative mb-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" className="input h-8 pl-8" />
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {list.map((r) => (
              <button key={r.code} type="button" className="menu-item" data-active={r.code === value} onClick={() => { onChange(r.code); close(); setQ(""); }}>
                <FlagIcon code={r.code} />
                <span className="flex-1 truncate">{r.name}</span>
                {r.code === value && <Check size={14} className="text-blue" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Menu>
  );
}

// Multi-select grid of country tiles with flags.
export function RegionGrid({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((x) => x !== code) : [...value, code]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
      {REGIONS.slice(0, 19).concat(REGIONS.filter((r) => r.code === "GLOBAL")).map((r) => {
        const on = value.includes(r.code);
        return (
          <button
            type="button"
            key={r.code}
            aria-pressed={on}
            onClick={() => toggle(r.code)}
            className={cx(
              "group h-9 flex items-center gap-2.5 px-2.5 rounded-md border text-left transition-colors",
              on ? "border-blue-edge bg-blue-soft text-ink" : "border-hairline hover:bg-row-hover text-body",
            )}
          >
            <FlagIcon code={r.code} size={20} />
            <span className="flex-1 truncate">{r.name}</span>
            <span className={cx("size-4 rounded-[3px] border grid place-items-center transition-colors", on ? "bg-blue border-blue" : "border-btn-edge bg-surface")}>
              {on && <Check size={10} weight="bold" color="#fff" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EnginePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (value.length < MAX_ENGINES) onChange([...value, id]);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ENGINES.map((e) => {
        const on = value.includes(e.id);
        return (
          <button
            type="button"
            key={e.id}
            aria-pressed={on}
            onClick={() => toggle(e.id)}
            className={cx(
              "relative h-[58px] flex items-center gap-3 px-3 rounded-md border text-left transition-colors",
              on ? "border-blue-edge bg-blue-soft" : "border-hairline hover:bg-row-hover",
            )}
          >
            <span className="size-8 rounded-md bg-surface grid place-items-center flex-none" style={{ boxShadow: "inset 0 0 0 1px var(--hairline)" }}>
              <EngineLogo id={e.id} size={17} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-ink font-medium truncate">{e.name}</span>
              <span className="block text-faint truncate">{e.live ? e.maker : `${e.maker} · coming soon*`}</span>
            </span>
            <span className={cx("size-4 rounded-[3px] border grid place-items-center flex-none transition-colors", on ? "bg-blue border-blue" : "border-btn-edge bg-surface")}>
              {on && <Check size={10} weight="bold" color="#fff" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
