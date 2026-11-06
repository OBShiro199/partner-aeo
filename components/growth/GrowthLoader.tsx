"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { useGrowth } from "@/lib/growth";

// Loads leads and audits once per agency so the sidebar badge and pages share them.
export function GrowthLoader() {
  const agencyId = useApp((s) => s.agency?.id);
  const load = useGrowth((g) => g.load);
  useEffect(() => {
    if (agencyId) load(agencyId).then(() => useGrowth.getState().runSprintQueue()).catch(() => {});
  }, [agencyId, load]);
  return null;
}
