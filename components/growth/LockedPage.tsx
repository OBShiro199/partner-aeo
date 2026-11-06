"use client";
import Link from "next/link";
import { LockSimple, Sparkle } from "@phosphor-icons/react";
import { FEATURE_COPY, type Feature } from "@/lib/plan";
import { useUpgrade } from "./Upgrade";
import { Button } from "@/components/ui";

// Full-page placeholder for a paid feature on the trial: says what it does, and how to get it.
export function LockedPage({ feature, preview }: { feature: Feature; preview?: React.ReactNode }) {
  const show = useUpgrade((u) => u.show);
  const copy = FEATURE_COPY[feature];
  return (
    <div className="relative overflow-hidden">
      {preview && <div className="pointer-events-none select-none opacity-40 blur-[1.5px]" aria-hidden>{preview}</div>}
      <div className={preview ? "absolute inset-0 grid place-items-center p-6" : "relative grid place-items-center px-6 py-20"}>
        {!preview && <div className="absolute inset-0 grid-bg grid-fade opacity-80" aria-hidden />}
        <div className="relative card p-6 max-w-[420px] text-center flex flex-col items-center gap-3 shadow-[0_8px_30px_rgba(8,9,10,0.08)]">
          <span className="size-10 rounded-md border border-blue-edge bg-blue-soft grid place-items-center text-blue-ink"><LockSimple size={18} /></span>
          <h2 className="t-16 font-medium text-ink">{copy.title}</h2>
          <p className="text-muted">{copy.body}</p>
          <div className="flex gap-2 mt-2">
            <Button variant="blue" onClick={() => show(feature)}><Sparkle size={14} /> See what&apos;s included</Button>
            <Link href="/sprint" className="btn btn-ghost">Your free audits</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
