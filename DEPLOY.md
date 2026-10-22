# Deploying the demo (Vercel + Postgres)

## 1. Push the branch
Push `demo-v2` to GitHub (private repo is fine).

## 2. Create the Vercel project
1. https://vercel.com/new, import the repo, select the `demo-v2` branch (or merge it to `main` first).
2. Framework preset: Next.js. No build settings to change.

## 3. Add Postgres (Supabase or Neon)
Any Postgres works. Tables are created on first request, with row-level security switched on and an append-only
trigger on the locks table (the database rejects any UPDATE or DELETE of a lock).

**Supabase**
1. In your Supabase project: Connect > Connection string > **Transaction pooler** (port 6543). This mode suits
   Vercel's serverless functions.
2. Copy the URI, put in your database password, and add `?sslmode=require` to the end. If the password contains
   special characters such as `@`, `#` or `/`, URL-encode them (or reset to a password without them).
3. In Vercel, set it as `DATABASE_URL`. (If you connect Supabase through Vercel's Storage/Marketplace integration
   instead, it sets `POSTGRES_URL`, which the app also reads.)

**Neon**: in the Vercel project, Storage > Create > Neon, and connect it. This sets `DATABASE_URL` automatically.

## 4. Environment variables
In Project Settings > Environment Variables (Production and Preview):

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | Your provider keys |
| `KL_AUTHORITY_PRIVATE_KEY`, `KL_AUTHORITY_PUBLIC_KEY` | Output of `npm run generate:key` (keep the private key secret) |
| `KL_ANTHROPIC_MODEL`, `KL_OPENAI_MODEL`, `KL_GOOGLE_MODEL` | Optional. Defaults: `claude-sonnet-5-5`, `gpt-5.6-terra`, `gemini-3.5-flash` |
| `KL_IP_HOURLY_LIMIT`, `KL_DAILY_LIMIT` | Optional caps on model calls (defaults 40 per IP per hour, 800 per day) |
| `NEXT_PUBLIC_SITE_URL` | Link back to the Guided Orchestration site |

Before deploying, run `npm run check:models` locally with the same keys to confirm every model ID responds.
Generate the authority key once and keep it: changing it means older locks show a different signer.

## 5. Domain
Project Settings > Domains: add `knowledge-lock.com` (or `demo.knowledge-lock.com`) and follow the DNS steps.

## 6. Smoke test
Start the demo, add the policy-breaking requirement, send for review (all three models should object),
remove it, review again, sign off as all three, lock, then try the quiet edit, ask the agent and check the ticket.

## Costs and limits
Each review is one call per provider (3 calls); asking the agent or checking a ticket is one call. The usage caps
above bound spend. Set spending limits in each provider's console as a backstop.

## Privacy
- Set `KL_IP_SALT` to any long random string (`openssl rand -base64 32`). IP addresses are only stored as a daily-changing keyed hash for rate limits, and usage rows are deleted after 48 hours.
- The demo links to the privacy notice and terms on guidedorchestration.com (`NEXT_PUBLIC_SITE_URL`).
- To delete a demo record on request, remove its rows from `kl_records`, `kl_locks` and `kl_supersessions`. The append-only triggers must be disabled for the delete (`ALTER TABLE kl_locks DISABLE TRIGGER kl_locks_append_only`), then re-enabled straight after.
