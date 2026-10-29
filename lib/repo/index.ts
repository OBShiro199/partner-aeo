import { demoRepo } from "./demo";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./types";

// Demo (sample data in the browser) only when explicitly asked for. Otherwise always real data.
export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Missing Supabase settings no longer fail the build: the first data call raises a clear error instead
// (see db() in ./supabase), which the app shows on screen.
export const repo: Repo = isDemo ? demoRepo : supabaseRepo;
export type { Repo } from "./types";
