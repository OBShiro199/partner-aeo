import { demoRepo } from "./demo";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./types";

// Demo (sample data in the browser) only when explicitly asked for. Otherwise always real data.
export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

if (!isDemo && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (or NEXT_PUBLIC_DEMO_MODE=1 for sample data).");
}

export const repo: Repo = isDemo ? demoRepo : supabaseRepo;
export type { Repo } from "./types";
