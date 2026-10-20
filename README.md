# Knowledge Lock demo

A hosted demo of Knowledge Lock: business units, stakeholders and multiple AI models agree on what's true, and the
agreed version is locked so every team and agent builds from the same signed-off source.

The demo follows one fictional scenario. Halden Bank is building an AI assistant for customer complaints, and
Product, Compliance and Engineering must agree its requirements without breaking the bank's locked complaints policy.

1. **Propose**: edit a draft set of requirements (or add one that quietly breaks policy).
2. **Review**: Anthropic, OpenAI and Google models check the draft against the locked policy; three stakeholders sign off.
3. **Lock**: when the sign-off rules pass, the content is hashed (RFC 8785 canonical JSON, SHA-256), signed (Ed25519)
   and stored in an append-only table. Every approval is bound to the exact content hash it was given for.
4. **Build from it**: an agent answers only from the locked record, a ticket is checked for drift, and a change creates
   a new version that goes back through review and replaces the old one.

## Run locally

```bash
npm install
cp .env.example .env.local    # add your API keys
npm run dev                   # http://localhost:3000
```

Without `DATABASE_URL` the demo uses an in-memory store. To try the flow without API keys, run `npm run dev:stub`
(fake model responses, clearly labelled, never used in production builds).

Check your keys and model IDs: `npm run check:models`.

## Layout

- `src/lib/protocol`: the Knowledge Lock protocol (types, canonical JSON, consensus rules, lock and verify). No dependencies.
- `src/lib/demo`: the demo scenario, storage (Postgres or memory), model calls and the service layer.
- `src/app`: pages (`/`, `/r/[id]` workspace, `/l/[lockId]` locked record) and API routes under `/api`.

See [DEPLOY.md](DEPLOY.md) to put it online.
