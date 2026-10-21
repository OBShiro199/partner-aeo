# Partner AEO: architecture, APIs, costs, pricing

21 Oct 2026. This replaces the single-business v1 PRD: same scoring ideas, now multi-tenant for agencies, on Supabase, with the Quiet Precision design system.

## 1. Product

An agency manages AEO for many clients. One workspace per agency (tenant), many seats, many clients. Each client tracks up to 10 prompts across up to 10 answer engines (4 live today).

**Flow:** sign up → onboarding (client count and markets with flags → agency website, which gives the name and favicon → engines → client domains → launch with progress and confetti) → dashboard with a spotlight tour ("Got it", "Skip tour") and a get-set-up checklist.

## 2. Multi-tenancy (Supabase)

- Every table carries `agency_id`. RLS policies call `is_member(agency_id)` and `has_role(agency_id, roles)`. These are `security definer` helpers, so policies don't recurse.
- Agencies are created only through `create_agency()`, which inserts the agency and the owner membership atomically.
- Seats: `agencies.seat_limit`. A trigger counts members plus pending invites. On sign-up, a matching invite joins the user automatically and reuses its seat.
- Client limit: `agencies.client_limit`, enforced by a trigger. Prompt limit: 10 active per client, enforced by a trigger.
- Writes to `scans`, `scan_results` and `api_usage` happen only from edge functions (service role). Members can read them.
- Storage bucket `brand-assets`, with paths `{agency_id}/…` and member-only writes.
- Realtime is enabled on `scan_results` and `scans`, ready for live dashboards.

## 3. APIs

| Need | API | Why |
| --- | --- | --- |
| Engine answers | DataForSEO **LLM Responses (live)**: `/v3/ai_optimization/{chat_gpt,claude,gemini,perplexity}/llm_responses/live` | One vendor and one bill for 4 engines. Returns the answer text, citations and exact cost per task. |
| Prompt writing | Anthropic **Claude Haiku 5.5** (`claude-haiku-5-5`), structured JSON output | About $0.0005 per client. Reads the homepage and writes 10 buyer prompts. |
| Site name and logo | Our `site-meta` edge function (HTML title and icons) plus the Google favicon service | Free |
| Later: Google AI Overviews and AI Mode | DataForSEO SERP API (`ai_overview` items) | Covers the biggest "engine" users actually see |
| Later: email | Resend | Invites, weekly client reports |
| Later: payments | Stripe Billing | Plans below; usage metering from `api_usage` |
| Later: scheduled scans | Supabase Cron (`pg_cron`) calling an edge function | Weekly per client |

DeepSeek, Grok, Copilot, Meta AI and Le Chat are selectable but marked "coming soon". They switch on when DataForSEO, or a direct API, supports them.

## 4. Costs

The DataForSEO LLM Responses live price is **$0.0006 per task plus the model's own token cost** (plus web search where used). The exact amount comes back in `tasks[].cost`, and we store it.

| Unit | Estimate |
| --- | --- |
| One check (1 prompt × 1 engine, web search) | $0.005 to $0.03, call it **$0.02** |
| One client scan (10 prompts × 4 engines) | 40 checks ≈ **$0.80** |
| One client per month, weekly scans | 172 checks ≈ **$3.40** |
| Prompt generation with Haiku | ≈ $0.0005 per client |
| Supabase Pro | $25/month base |

**Test budget now:** $1 on DataForSEO. The platform cap is 3 checks or $0.30, whichever comes first, one prompt × one engine at a time.

## 5. Pricing (proposal)

| Plan | Price | Clients | Seats | Scans | API cost at cap | Gross margin |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | $149/mo | 10 | 3 | Weekly | ~$34 | ~77% |
| Growth | $349/mo | 30 | 10 | Weekly, plus on-demand | ~$103 | ~70% |
| Scale | $899/mo | 100 | 50 | Twice weekly | ~$600 | ~33% at full use (raise to $1,199, or keep weekly) |

Most agencies won't use every slot, so real margins sit higher. Add-ons later: extra clients at $9 each per month, white-label PDF reports, daily scans for priority clients.

## 6. Next steps

1. Allow `api.dataforseo.com` and `*.supabase.co` in the build environment, apply the migration, deploy the functions and set the secrets.
2. Run 3 single checks, one per engine (ChatGPT, Perplexity, Claude), and confirm the response shape, citations and cost.
3. Scheduled weekly scans: a `run-scan` function that loops prompts × engines with a concurrency of 4, triggered by `pg_cron`.
4. Stripe Checkout and the customer portal. Resend for invites and reports.
