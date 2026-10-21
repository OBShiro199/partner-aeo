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
