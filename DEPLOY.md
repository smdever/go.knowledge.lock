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

## The product (app.knowledge-lock.com)

The same repo runs the product when `KL_MODE=app`. It's a second Vercel project with its own database, so the demo above keeps running unchanged. In product mode the demo pages are switched off, and in demo mode the product pages don't exist.

### 1. Supabase (a new project, not the demo's)
1. Create a project in **London (eu-west-2)**.
2. **Project Settings → API keys:** copy the Project URL and the publishable key.
3. **Connect → Transaction pooler:** copy the connection string (port 6543) and add `?sslmode=require`. This is `DATABASE_URL`.
4. **Authentication → URL Configuration:** Site URL `https://app.knowledge-lock.com`. Under Redirect URLs, add `https://app.knowledge-lock.com/**`.
5. **Authentication → Emails → SMTP settings:** use Resend so sign-in emails aren't rate-limited. Host `smtp.resend.com`, port `465`, user `resend`, password: a Resend API key, sender e.g. `no-reply@knowledge-lock.com` (verify the domain in Resend first).
6. **Authentication → Emails → Magic link template:** change the link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`, so a link requested on a laptop also works when opened on a phone.

### 2. Vercel
Create a second project from this repo (e.g. `knowledge-lock-app`) and add the domain `app.knowledge-lock.com`. Environment variables:

| Variable | Value |
| --- | --- |
| `KL_MODE` | `app` |
| `KL_APP_URL` | `https://app.knowledge-lock.com` |
| `DATABASE_URL` | The product's Supabase transaction pooler string |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | From step 1.2 |
| `KL_ADMIN_EMAILS` | Your email (comma-separate several). Admins can create organisations |
| `RESEND_API_KEY`, `KL_EMAIL_FROM` | For invite emails, e.g. `Knowledge Lock <no-reply@knowledge-lock.com>` |
| `KL_AUTHORITY_PRIVATE_KEY`, `KL_AUTHORITY_PUBLIC_KEY` | A new pair for the product: `node scripts/generate-authority-key.mjs` |
| `NEXT_PUBLIC_SITE_URL` | `https://guidedorchestration.com` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | Needed from phase 2 (model review) |
| `KL_ORG_HOURLY_LIMIT` | Optional. AI calls per organisation per hour (default 300) |

### 3. First sign-in
Go to app.knowledge-lock.com, sign in with your admin email, open **Admin** and create an organisation for each design partner. Its owner gets an invite and invites the rest of their team from **Team**. Only people with an account, a pending invite or admin rights are sent sign-in links.

### How records work in the product
- An owner proposes the organisation's **Policy** first (optional but recommended). Every later record is reviewed against it.
- Anyone who is an owner or signer creates a **New record**: a title, one statement per line, the people who must sign it, and how many of them must approve (the quorum).
- The AI models review it; objections are fixed in place. Each chosen signer then approves or asks for changes from their own account. Any open objection blocks the lock.
- Once the quorum is met, any owner or signer locks it. A change to a locked record becomes the next version, with the same signers.

### Running the product locally
In `.env.local`: `KL_MODE=app`, `KL_DEV_AUTH=1` (sign in as any email without Supabase; never active on Vercel), `KL_ADMIN_EMAILS=you@example.com` and a local `DATABASE_URL`. Invite links are printed in the terminal when Resend isn't set up.
