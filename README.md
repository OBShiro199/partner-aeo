# Partner AEO

The answer engine workspace for agencies. An agency signs up, adds its clients by domain, and tracks how ChatGPT, Gemini, Claude and Perplexity mention, rank and cite each client.

Stack: Next.js 16 (App Router, client-rendered app shell) · Tailwind 4 · Zustand · Supabase (Auth, Postgres with RLS, Storage, Edge Functions) · DataForSEO LLM Responses API · Claude Haiku 5.5 for prompt writing. Design system: Quiet Precision (`app/globals.css`).

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys
npm run dev                  # http://localhost:3000
```

Set `NEXT_PUBLIC_DEMO_MODE=1` to run the whole app in the browser on sample data: no Supabase, no API spend. Demo accounts live in localStorage.

## Set up Supabase (project `nfnrezdqbunlrmdqmxzj`)

1. **Schema.** Apply `supabase/migrations/20261021000000_init.sql`. Either paste it into the SQL editor, or:
   ```bash
   npx supabase link --project-ref nfnrezdqbunlrmdqmxzj
   npx supabase db push
   ```
2. **Edge functions.**
   ```bash
   npx supabase functions deploy site-meta generate-prompts run-llm-check dfs-status
   ```
3. **Function secrets** (Dashboard > Edge Functions > Secrets, or `npx supabase secrets set`):
   - `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
   - `ANTHROPIC_API_KEY` (optional: without it, prompts come from templates)
   - `DFS_MODELS` (optional JSON to override engine models, e.g. `{"chatgpt":"gpt-4o-mini"}`)
4. **Auth.** For local testing, turn off "Confirm email" under Authentication > Providers > Email, or sign-ups wait for a confirmation link.
5. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and leave `NEXT_PUBLIC_DEMO_MODE` empty.

The secret key (`sb_secret_…`) is never used by the browser app. Keep it out of git and out of any `NEXT_PUBLIC_` variable.

## Spend safety

- `platform_limits` (one row) caps paid DataForSEO calls: **3 calls, $0.30 total, 1 prompt × 1 engine per request**. `run-llm-check` refuses with a 402 once either cap is hit. Raise them in SQL when you're ready:
  ```sql
  update platform_limits set dfs_max_calls = 500, dfs_max_spend_usd = 20;
  ```
- Every paid call is logged in `api_usage` with its exact cost from DataForSEO.
- `npm run dfs -- …` is a local, one-query tester with its own 3-call budget in `.dfs-usage.json`:
  ```bash
  npm run dfs -- balance                       # free
  npm run dfs -- models chatgpt                # free
  npm run dfs -- ask chatgpt "best crm for plumbers in leeds" --brand "Acme" --domain acme.com
  ```

## Where things are

| Path | What |
| --- | --- |
| `app/page.tsx`, `components/landing/` | Landing page |
| `app/(auth)/` | Log in, sign up |
| `app/onboarding/` | 5-step agency onboarding (size and markets, website, engines, clients, launch) |
| `app/(app)/dashboard` | Dashboard: client filter, KPIs, trend, engines, client book, prompt grid, share of voice, sources, tour, checklist |
| `app/(app)/clients` | Client list and client detail (prompts, answers, competitors, settings) |
| `app/(app)/lab` | API lab: one prompt, one engine, one check |
| `app/(app)/billing`, `settings` | Plans and usage; agency, markets, engines, team and seats |
| `components/AddClientDialog.tsx` | The add-client flow (one dialog that morphs between steps) |
| `lib/store.ts` | Zustand store: workspace state, filters, optimistic updates |
| `lib/repo/` | Data layer: `supabase.ts` (real) and `demo.ts` (sample data) behind one interface |
| `supabase/functions/_shared/analyse.ts` | Mention, rank, citation and visibility scoring, shared by the app and the edge functions |

See `docs/PLAN.md` for the architecture, API choices, costs and pricing.
