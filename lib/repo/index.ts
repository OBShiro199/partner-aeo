import { demoRepo } from "./demo";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./types";

export const isDemo =
  process.env.NEXT_PUBLIC_DEMO_MODE === "1" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const repo: Repo = isDemo ? demoRepo : supabaseRepo;
export type { Repo } from "./types";
