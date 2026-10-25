import type { Hub, ProspectReport, SalesKit } from "../supabase/functions/_shared/audit.ts";
export type Role = "owner" | "admin" | "member";
export type Intent = "best_for" | "problem" | "comparison" | "local" | "other";
export type ResultStatus = "pending" | "done" | "failed" | "skipped";

export type Agency = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  favicon_url: string | null;
  client_count_band: string | null;
  regions: string[];
  engines: string[];
  plan: string;
  seat_limit: number;
  client_limit: number;
  monthly_budget_usd: number;
  onboarded_at: string | null;
  tour_completed_at: string | null;
  created_at: string;
};

export type Member = { user_id: string; role: Role; email: string; full_name: string; created_at: string };
export type Invite = { id: string; email: string; role: Role; created_at: string };

export type Client = {
  id: string;
  agency_id: string;
  name: string;
  domain: string;
  website: string | null;
  favicon_url: string | null;
  description: string | null;
  industry: string | null;
  region: string;
  aliases: string[];
  status: "active" | "paused" | "archived";
  created_at: string;
};

export type Competitor = { id: string; client_id: string; name: string; domain: string | null };

export type Prompt = {
  id: string;
  client_id: string;
  text: string;
  intent: Intent;
  source: "haiku" | "template" | "manual";
  active: boolean;
  position: number;
  created_at: string;
};

export type Citation = { url: string; domain: string; title?: string };

export type Result = {
  id: string;
  scan_id: string;
  client_id: string;
  prompt_id: string | null;
  prompt_text: string;
  engine: string;
  model: string | null;
  status: ResultStatus;
  response_text: string | null;
  citations: Citation[];
  mentioned: boolean | null;
  position: number | null;
  competitors_mentioned: string[];
  own_domain_cited: boolean;
  cost_usd: number;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

export type UsageRow = { provider: string; endpoint: string; status: string; cost_usd: number; created_at: string };

export type DfsStatus = {
  configured: boolean;
  balance_usd: number | null;
  calls_used: number;
  calls_max: number;
  spent_usd: number;
  max_spend_usd: number;
};

export type SiteMeta = { domain: string; name: string; description: string | null; favicon_url: string; reachable: boolean };

export type Workspace = {
  agency: Agency;
  role: Role;
  members: Member[];
  invites: Invite[];
  clients: Client[];
  competitors: Competitor[];
  prompts: Prompt[];
  results: Result[];
};

export type User = { id: string; email: string; full_name?: string };

export type NewClientInput = {
  name: string;
  domain: string;
  favicon_url: string | null;
  description: string | null;
  industry: string | null;
  region: string;
  competitors: { name: string; domain: string | null }[];
  prompts: { text: string; intent: Intent; source: Prompt["source"] }[];
};

// ---------------------------------------------------------------------------
// Growth: widget, audits (Strategy Engine), leads, credits
// ---------------------------------------------------------------------------
export type { Hub, ProspectReport, SalesKit };

export type Widget = {
  id: string;
  agency_id: string;
  public_key: string;
  enabled: boolean;
  headline: string;
  subhead: string;
  brand_color: string;
  logo_url: string | null;
  sender_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  booking_url: string | null;
  allowed_hosts: string[];
  default_region: string;
};

export type Audit = {
  id: string;
  agency_id: string;
  widget_id: string | null;
  source: "widget" | "manual";
  depth: "lite" | "full";
  prospect_domain: string;
  prospect_name: string | null;
  keyword: string;
  competitor_domain: string | null;
  competitor_name: string | null;
  region: string;
  status: "queued" | "running" | "complete" | "failed";
  stage: string | null;
  score: number | null;
  risk: "high" | "at_risk" | "visible" | null;
  deflection_rate: number | null;
  report: ProspectReport | Record<string, never>;
  hub: Hub;
  assets: SalesKit;
  cost_usd: number;
  error: string | null;
  cached_from: string | null;
  host: string | null;
  created_at: string;
  finished_at: string | null;
};

export type LeadStatus = "new" | "contacted" | "meeting" | "won" | "lost";
export type Lead = {
  id: string;
  agency_id: string;
  audit_id: string;
  name: string | null;
  email: string;
  phone: string;
  status: LeadStatus;
  notes: string | null;
  report_sent_at: string | null;
  created_at: string;
};

export type CreditMeter = { used: number; allowance: number; overage_usd: number; overage_count: number };
export type Credits = { plan: string; overage_enabled: boolean; widget_scans: CreditMeter; strategy_runs: CreditMeter; resets_at: string };
