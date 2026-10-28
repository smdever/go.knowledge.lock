# Knowledge Lock for Confluence (proof of concept)

A Forge app that links a Confluence page to a locked Knowledge Lock record, shows the record's status near the page title,
and checks the page against the record when someone asks. Built from the locked brief
"Confluence proof of concept: show a page's locked record and check it for drift". It's for installing privately on our own
Confluence site; it isn't listed on the Marketplace.

## What it does

- **Settings** (Confluence administrators): paste an organisation API key from Knowledge Lock. The app tries it, then keeps it in
  Forge's secret storage. It's never shown again.
- **Label near the title**: "Knowledge Lock" on unlinked pages. On linked pages, one of "Locked v[n]",
  "Newer version available (v[n])", "Retired", "Organisation closing" or "Can't reach Knowledge Lock".
- **Panel** (select the label): the record's title, version, who signed it off and when, and a link to it. Editors can link
  or unlink the page. "Check for drift" sends the page's current text to Knowledge Lock, which checks it and keeps no copy.
  Knowledge Lock's activity log records that a check ran, for which record and version, from which site, and how many findings.

The app has no permission to change Confluence. Which record a page is linked to is kept in the app's own Forge storage.

## Install on our Confluence site

You'll need Node.js 22.23 or later (the Forge CLI refuses older versions), an Atlassian developer account and a Confluence
Cloud site to test on (a free one is fine).

```bash
cd integrations/confluence
npm install
npx forge login          # uses an Atlassian API token
npx forge register       # gives the app an ID and writes it into manifest.yml
npx forge deploy
npx forge install        # choose Confluence and your test site
```

Then, in Knowledge Lock, an owner creates an API key on the API keys page (name it "Confluence"). In Confluence, go to
Settings, then Apps, then Knowledge Lock, and paste the key.

To try it: open a record in Knowledge Lock, copy the address from the browser, open a Confluence page you can edit, select
"Knowledge Lock" near the title, and paste the link.

## Checks

```bash
npm run typecheck
npm test                 # unit tests
```

The resolver tests run the app's backend against a local Knowledge Lock server, with Forge storage and Confluence faked.
They need `KL_TEST_BASE` (the server), `KL_TEST_SETUP` (a JSON file with `key` and `lockId`), `KL_TEST_COOKIE`
(an owner's session) and `KL_TEST_DB` (the database, used to simulate an organisation closing).

## Knowledge Lock API used

- `GET /api/v1/locks/{lockId}`: the record, plus a `summary` written for display (signers by name and title, never email)
- `POST /api/v1/locks/{lockId}/check` with `{ work, source: { kind: "confluence", site } }`
- Errors carry a `code`: `invalid_key`, `org_closing`, `retired`, `not_found` or `rate_limited`

See [LEARNINGS.md](LEARNINGS.md) for what building it taught us.
