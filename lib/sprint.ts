"use client";
// The free sprint's three answers (client site, niche, location) travel from the public intake
// form through sign-up and onboarding in localStorage, so nobody types them twice.
export type SprintInput = { client_url: string; niche: string; location: string; region?: string };
const KEY = "pa_sprint";

export function readSprint(): SprintInput | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.client_url === "string" ? v : null;
  } catch { return null; }
}
export function saveSprint(v: SprintInput) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: the form asks again */ }
}
export function clearSprint() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
