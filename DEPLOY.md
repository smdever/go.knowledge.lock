# Deploying the demo (Vercel + Postgres)

## 1. Push the branch
Push `demo-v2` to GitHub (private repo is fine).

## 2. Create the Vercel project
1. https://vercel.com/new, import the repo, select the `demo-v2` branch (or merge it to `main` first).
2. Framework preset: Next.js. No build settings to change.

## 3. Add Postgres
1. In the Vercel project: Storage > Create > Neon (Postgres). Connect it to the project.
2. This sets `DATABASE_URL` automatically. Tables are created on first request.
   Locks are stored in an append-only table: the database rejects any UPDATE or DELETE on them.

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
