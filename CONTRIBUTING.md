# Contributing to Lens

Thanks for considering a contribution. This page covers how this repository
works (it is a little unusual), what tends to get accepted, and the one legal
step required before code can be merged.

## How this repository works

This repository is a **curated snapshot** of a private development repository,
published one commit per release. That has two consequences worth knowing
before you invest time:

- Releases arrive as single `Release <date>` commits rather than the
  original day-to-day history.
- An accepted pull request is **ported into the development repository** and
  ships in the next release, so your commit will not appear here verbatim.
  Contributors are credited in the release notes.

If that model doesn't work for you, it's better to know now than after writing
a patch.

## What's welcome

- **Bug fixes** — especially anything you hit while self-hosting.
- **Self-hosting and deployment improvements** — Docker, database setup,
  documentation gaps, unclear errors during first-run setup.
- **Accessibility and internationalisation fixes.**
- **Documentation** — if something in the setup was confusing, fixing it helps
  the next person more than you'd think.

Before starting anything large, **open an issue first**. Lens has an opinionated
design and a commercial edition built from the same code, so a big change that
hasn't been discussed may not be mergeable no matter how good it is.

## What's out of scope

The operator surface of the hosted service — multi-tenant account management,
billing, plans, trials and the marketing site — is not part of this edition and
is not present in this repository.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase details
npm run dev                  # http://localhost:3000
```

You need a Supabase project (hosted or self-hosted) with
[`supabase/schema.sql`](supabase/schema.sql) applied. Full instructions,
including running the whole Supabase stack yourself, are in
[`docs/self-hosting.md`](docs/self-hosting.md).

Before opening a pull request:

```bash
npx tsc --noEmit
npm run build
```

Keep changes focused — one concern per pull request — and match the style of
the surrounding code rather than introducing new patterns.

## Contributor License Agreement (required)

Lens is dual-licensed: this edition is AGPL-3.0, and commercial editions fund
the work. To distribute your contribution under both, a
[Contributor License Agreement](CLA.md) is required before anything can be
merged.

In short: **you keep your copyright**, and you grant permission for your
contribution to be distributed under both the open-source and the commercial
licence. Please read [CLA.md](CLA.md) — it is short — and confirm agreement in
your pull request as described at the end of it.

If your employer owns the code you write (common for work done on company time
or equipment), your employer needs to agree instead of you. Section 5 of the
CLA explains this.

## Reporting bugs and security issues

- **Bugs:** open an issue with steps to reproduce, what you expected, and your
  environment (Lens version from Settings → About, database, browser).
- **Security vulnerabilities:** please do **not** open a public issue. Use
  GitHub's private reporting — the **Security** tab → *Report a vulnerability* —
  so the problem can be fixed before it's public.
