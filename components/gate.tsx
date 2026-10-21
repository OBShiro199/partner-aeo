"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Mark } from "./brand";

// Boots the store once and routes by state: anon -> /login, no agency -> /onboarding.
export function Gate({ need, children }: { need: "anon" | "no-agency" | "ready"; children: ReactNode }) {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const boot = useApp((s) => s.boot);
  const router = useRouter();

  useEffect(() => { boot(); }, [boot]);

  useEffect(() => {
    if (status === "idle" || status === "loading" || status === "error") return;
    if (status === need) return;
    if (need === "no-agency" && status === "ready") return; // onboarding may finish after the agency exists
    if (status === "anon") router.replace("/login");
    else if (status === "no-agency") router.replace("/onboarding");
    else if (status === "ready") router.replace("/dashboard");
  }, [status, need, router]);

  if (status === "error") {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-[360px] flex flex-col items-center gap-3">
          <Mark size={28} />
          <p className="text-ink font-medium t-14">Couldn&apos;t load your workspace</p>
          <p className="text-muted">{error} Check your connection, then reload.</p>
          <button className="btn mt-2" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
  const ok = status === need || (need === "no-agency" && status === "ready");
  if (!ok) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="flex items-center gap-3 text-faint fade-in"><span className="spinner" /> Loading workspace</div>
      </div>
    );
  }
  return <>{children}</>;
}
