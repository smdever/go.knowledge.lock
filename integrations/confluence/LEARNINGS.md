# What the Confluence proof of concept taught us

Statement R14 of the brief asks for a short note on what Forge made easy, what it made hard, and what a Marketplace version
would need. This is the first version, written after building and testing the app against fakes of Confluence and Forge.
The section at the end is for what we find once it's running on a real Confluence site.

## What Forge made easy

- **Distribution and hosting.** The app runs on Atlassian's infrastructure. There's no server of ours in Confluence's path,
  and installing it is one command.
- **Secrets.** Forge has secret storage built in, so the API key never reaches the browser and we didn't have to build
  encryption for it.
- **Design and themes.** UI Kit components are Atlassian's own, so the panel follows Confluence's light and dark themes
  without any work from us. The flip side is that we can't style anything, so it looks like Confluence, not like Knowledge Lock.
- **Least privilege.** Scopes are declared in one file. The app gets by with three: read pages, read blog posts, and its own
  storage. Nothing lets it write to Confluence.
- **Our own API.** The drift check needed no new AI work. Knowledge Lock's existing check endpoint did the job. The server
  changes were small: a display-ready summary, error codes an app can act on, and a log entry for each check.

## What Forge made hard

- **Development needs a real site.** There's no local Confluence to test against. The CLI won't even lint without an
  Atlassian login, so all our automated tests run against fakes. Real behaviour (does the label refresh after linking? what
  does the page context look like?) can only be confirmed by deploying.
- **Tooling is strict about Node versions.** The current CLI refuses Node versions older than 22.23.
- **The label is the only always-visible surface.** A byline item's text is set once per page view, so after linking,
  the page has to reload to show the new label. It can't be coloured, so "Retired" and "Locked v2" look alike until
  someone opens the panel.
- **Who's an administrator.** Confluence only shows the settings page to administrators, but proving that inside the
  settings code would need an extra permission to read user details. We rely on Atlassian showing the page only to
  administrators, and refuse settings calls from any other part of the app. This needs confirming on a real site.
- **Page length.** Knowledge Lock checks up to 4,000 characters, so long pages are only partly checked. The panel says so,
  but a real version would need to check long pages in sections.

## What a Marketplace version would need

- **Security and privacy review.** Atlassian reviews Marketplace apps, and customers ask about data handling. Our privacy
  notice would need a Confluence paragraph (like the Jira one) before any customer installs it. The proof of concept is
  only on our own site, so the notice hasn't been changed yet.
- **A connection flow instead of pasting keys.** Administrators shouldn't have to copy API keys between products. A
  Marketplace version would connect a Confluence site to a Knowledge Lock organisation with a sign-in flow.
- **Usage limits that fit busy sites.** Every page view asks Knowledge Lock for the record's status. We cache it for two
  minutes, but a large site could still use up an API key's hourly limit. A site-level allowance or pushed updates would
  fix this.
- **Linking more than one record, and checking on save.** Both are out of scope for this brief, but they're the first
  things a real team would ask for.
- **Licensing and pricing**, through the Marketplace's own billing.
- **Data residency.** Large Atlassian customers choose where their data lives, so we'd need to say where Knowledge Lock
  processes page text.

## After installing on a real site

To fill in once it's running:

- Does the label update after linking, or only after a full reload?
- What does the label look like in light and dark themes, and on a phone?
- Is the settings page really only shown to administrators?
- How long does a drift check take from pressing the button to seeing findings?
