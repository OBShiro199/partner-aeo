"use client";
import { useEffect, useState } from "react";
import { useGrowth } from "@/lib/growth";
import type { Audit } from "@/lib/types";

// Full audit row (report, hub, assets), loaded on demand and kept live by the growth store.
export function useAudit(id: string | null | undefined): { audit: Audit | null; missing: boolean } {
  const audit = useGrowth((g) => (id ? g.full[id] ?? null : null));
  const loadAudit = useGrowth((g) => g.loadAudit);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!id) return;
    loadAudit(id).then((a) => setMissing(!a)).catch(() => setMissing(true));
  }, [id, loadAudit]);
  // Poll while running, in case Realtime is unavailable.
  const running = audit?.status === "running" || audit?.status === "queued";
  useEffect(() => {
    if (!id || !running) return;
    const t = setInterval(() => loadAudit(id), 8000);
    return () => clearInterval(t);
  }, [id, running, loadAudit]);
  return { audit, missing };
}
