# Lens — Community Edition

**Lens** is a UX research repository and participant-management platform: recruit
and manage participants, analyze interviews in a transcript workspace, run
unmoderated usability tests, organize evidence-linked insights on affinity and
Kanban boards, and turn research into product decisions.

This is the **community (self-hosted) edition** of [Lens](https://lensresearch.app) —
the full product, built to run on your own infrastructure against your own
Supabase instance. Compared to the cloud service it omits only the SaaS surface
(the marketing site and the multi-tenant operator console); it runs as a
single-workspace install with unlimited members and no trial or plan gating.

> **How this repository is maintained:** it is a curated snapshot of the
> private development repository, published as one commit per release. Issues
> and pull requests are welcome — accepted changes are ported into the main
> line and ship in the next release.

## Features

- **Participants** — table/cards/list views, filters, rich profiles, consent tracking, CSV import
- **Projects** — tabbed hubs: overview, participants, interviews, insights, affinity, Kanban, reports
- **Interviews & transcripts** — select any transcript text → convert to insight, observation, or pain point; comments; attachments; follow-ups
- **Insights** — reusable, evidence-linked findings with severity, impact, and confidence
- **Unmoderated testing** — block-based test builder, tokenized public participant links, first-click heatmaps, and (with the drop-in [beacon snippet](public/lens-beacon.js)) click paths, rage-click detection, and automatic success detection
- **Boards** — affinity mapping with cluster promotion; Kanban triage lanes over insights
- **AI assistant (optional, bring-your-own-key)** — duplicate detection with real merge, themes, gaps, ask-your-research; Anthropic, OpenAI, xAI, or Google keys, stored encrypted server-side
- **Library** — personas, themes, and tags with editable detail pages
- **Governance** — role-based access control, GDPR tooling (consent, anonymize, erasure, exports), audit log
- **Real exports** — JSON, CSV, Excel, PDF report, ZIP archive, all generated client-side

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Zustand ·
Supabase (Postgres + RLS, Auth, Storage)

## Self-hosting quickstart

1. Create a Supabase project (an EU region if you need EU data residency), or
   run the open-source Supabase stack on your own hardware.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)
   — it creates the entire database: tables, row-level security, auth trigger.
3. `cp .env.example .env.local` and fill in the variables (each one is
   explained in the file).
4. Run it:

   ```bash
   npm install
   npm run build
   npm start          # http://localhost:3000
   ```

5. **First run:** the sign-in screen offers a one-time setup flow that creates
   your workspace and its first admin — after that, admins add teammates in
   Settings → Team & roles. The setup door closes itself once a login exists.

The full walkthrough is in [`docs/self-hosting.md`](docs/self-hosting.md).

## Docker

```bash
docker build -t lens .
docker run -p 3000:3000 --env-file .env.local lens
```

The build args / runtime variables are the same ones documented in
[`.env.example`](.env.example); see [`docs/self-hosting.md`](docs/self-hosting.md).

## Contributing

Bug reports and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for how this repository works, what tends to
get accepted, and the [Contributor License Agreement](CLA.md) required before
code can be merged (you keep your copyright).

## License

Lens Community Edition is licensed under the **GNU AGPL v3.0** — see
[LICENSE](LICENSE). Copyright (c) 2026 Erik Niemeijer.

**Exception — the beacon snippet.** [`public/lens-beacon.js`](public/lens-beacon.js),
the script you embed in applications placed under test, is **MIT-licensed**
([LICENSE-beacon](LICENSE-beacon)). Embedding it in an app — closed-source apps
included — carries no AGPL obligations; the AGPL covers the Lens server, not
apps that merely send events to it.

Lens is also available under a commercial license: the hosted cloud service and
a supported self-hosted delivery, both at [lensresearch.app](https://lensresearch.app).
