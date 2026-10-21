import type {
  Agency, Client, Competitor, DfsStatus, Intent, Invite, NewClientInput, Prompt, Result, Role, SiteMeta, UsageRow, User, Workspace,
} from "../types";

export type NewAgencyInput = {
  name: string;
  website: string | null;
  domain: string | null;
  favicon_url: string | null;
  client_count_band: string | null;
  regions: string[];
  engines: string[];
};

export type GeneratedPrompts = { prompts: { text: string; intent: Intent }[]; source: "haiku" | "template"; category?: string | null };

export type CheckResponse = { result: Result; usage: { calls_used: number; calls_max: number | null; spent_usd: number } };

export interface Repo {
  mode: "demo" | "supabase";
  currentUser(): Promise<User | null>;
  onAuthChange(cb: (u: User | null) => void): () => void;
  signUp(email: string, password: string, fullName: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  loadWorkspace(): Promise<Workspace | null>;
  createAgency(input: NewAgencyInput): Promise<Agency>;
  updateAgency(id: string, patch: Partial<Agency>): Promise<Agency>;

  siteMeta(url: string): Promise<SiteMeta>;
  generatePrompts(agencyId: string, client: { name: string; domain: string; description?: string | null; region: string; industry?: string | null; competitors: string[] }, count?: number): Promise<GeneratedPrompts>;

  addClients(agencyId: string, inputs: NewClientInput[]): Promise<{ clients: Client[]; competitors: Competitor[]; prompts: Prompt[]; results: Result[] }>;
  updateClient(id: string, patch: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  setCompetitors(agencyId: string, clientId: string, list: { name: string; domain: string | null }[]): Promise<Competitor[]>;

  addPrompt(agencyId: string, clientId: string, text: string, intent: Intent): Promise<Prompt>;
  updatePrompt(id: string, patch: Partial<Prompt>): Promise<Prompt>;
  deletePrompt(id: string): Promise<void>;

  runCheck(agencyId: string, args: { promptId?: string; clientId: string; promptText?: string; engine: string }): Promise<CheckResponse>;
  dfsStatus(agencyId: string): Promise<DfsStatus>;
  usage(agencyId: string): Promise<UsageRow[]>;

  invite(agencyId: string, email: string, role: Role): Promise<Invite>;
  revokeInvite(id: string): Promise<void>;
  removeMember(agencyId: string, userId: string): Promise<void>;
}
