"use client";
import Link from "next/link";
import { create } from "zustand";
import { Check, LockSimple } from "@phosphor-icons/react";
import { FEATURE_COPY, type Feature } from "@/lib/plan";
import { Dialog, DialogClose } from "@/components/ui";

// One upgrade dialog for every locked feature: anything can call useUpgrade.getState().show("deck").
export const useUpgrade = create<{ feature: Feature | null; show: (f: Feature) => void; hide: () => void }>((set) => ({
  feature: null,
  show: (feature) => set({ feature }),
  hide: () => set({ feature: null }),
}));

const STARTER = ["Editable pitch decks and closing scripts", "Full 25-prompt blueprints with search volume", "Lead widget for your website", "Strategy Engine runs every month", "Day-1 fixes for your clients' sites"];

export function UpgradeDialog() {
  const { feature, hide } = useUpgrade();
  const copy = feature ? FEATURE_COPY[feature] : null;
  return (
    <Dialog open={!!copy} onClose={hide} width={460} labelledBy="upgrade-title">
      {copy && (
        <div className="p-6 relative">
          <DialogClose onClick={hide} />
          <span className="size-10 rounded-md border border-blue-edge bg-blue-soft grid place-items-center"><LockSimple size={18} className="text-blue-ink" /></span>
          <h2 id="upgrade-title" className="t-16 font-medium text-ink mt-4">{copy.title}</h2>
          <p className="text-muted mt-1.5">{copy.body}</p>
          <ul className="mt-5 flex flex-col gap-2">
            {STARTER.map((t) => <li key={t} className="flex items-center gap-2 text-ink"><Check size={13} weight="bold" className="text-blue" />{t}</li>)}
          </ul>
          <div className="flex gap-2 mt-6">
            <Link href="/billing" onClick={hide} className="btn btn-primary flex-1">See plans</Link>
            <button className="btn btn-ghost" onClick={hide}>Not now</button>
          </div>
          <p className="text-faint t-12 mt-3">Starter is $149 a month. Your free audits and PDFs stay yours either way.</p>
        </div>
      )}
    </Dialog>
  );
}

// A small lock badge for buttons and nav items that need a paid plan.
export function LockBadge({ className }: { className?: string }) {
  return <LockSimple size={12} weight="bold" className={className ?? "text-faint"} aria-label="Paid plans" />;
}
