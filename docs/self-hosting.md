# Self-hosted edition — build & run

The self-hosted edition is a **single-tenant** build of Lens for running on your
own infrastructure. The same build ships two ways: **from source** (the
community repository), or as a prebuilt, per-customer **Docker image** — the
commercial delivery, which includes support and does not include source.

## What's different from Cloud

The edition is selected by `NEXT_PUBLIC_DEPLOYMENT_MODE=self-hosted` (baked into
the image). In this mode:

- The **platform-owner console** (`/admin`) and the **cross-tenant account APIs**
  (`/api/admin/accounts`) return **404** — they don't exist for the customer.
- **Trials** are off — a self-hosted license never expires.
- **Seat caps** are off — unlimited researchers (perpetual license).

Everything else — the repository, AI (with the customer's own key), GDPR tooling,
per-workspace user management — works normally. The tenant-scoped
`/api/admin/create-user` (adding members to their own workspace) stays enabled.

> Leave `NEXT_PUBLIC_DEPLOYMENT_MODE` unset for your own Cloud deploy — it
> defaults to `cloud` and keeps the full operator surface.

## Prerequisites

- Your own **Supabase project** (or Postgres + Auth) — its URL and anon key are
  public (protected by RLS), so they're safe to bake into the image.
- A **Docker** host.

## Step 1 — Database (structure only)

For a **fresh install**, run [`supabase/schema.sql`](../supabase/schema.sql) in
the Supabase SQL editor — it creates the entire database (tables, row-level
security, the auth trigger). **Upgrading an existing database** instead? Don't
re-run the schema; apply the dated files in `supabase/migrations/` that are
newer than your install, in order.

**Do not run `supabase/seed.sql`** — that's the Northwind demo dataset. A real
customer starts with an empty workspace; their content is created in the app.
(`schema.sql` seeds one example `Northwind` account row; it's unused in self-hosted
and can be ignored or deleted — the first-run setup below creates the customer's
own account and admin.)

## Step 2 — Build the image

`NEXT_PUBLIC_*` values are inlined at **build** time, so the public Supabase
config is passed as build args (for commercial delivery: one image per
customer, against that customer's Supabase project):

```bash
docker build -t lens-selfhosted \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<customer>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg SOURCE_COMMIT=$(git rev-parse --short HEAD) \
  .
```

The image contains only the compiled standalone server (no source, no full
`node_modules`), with the self-hosted edition baked in — about **315 MB**, and
multi-arch (verified on arm64). `SOURCE_COMMIT` is optional but recommended: it
stamps the build id shown on Settings → About and `/api/version`.

## Step 3 — Run

Server-only secrets are supplied at **run** time (never baked in):

```bash
docker run -p 3000:3000 --env-file .env.production lens-selfhosted
```

`.env.production` (server-side only — see [`.env.example`](../.env.example)):

```
SUPABASE_SERVICE_ROLE_KEY=...     # needed to create workspace members
AI_KEY_SECRET=...                 # encrypts the workspace AI key at rest
ANTHROPIC_API_KEY=...             # optional — AI without an in-app workspace key
OPENAI_API_KEY=...                # optional (also: XAI_API_KEY, GEMINI_API_KEY)
```

`RESEND_API_KEY` and any owner-allowlist variables are Cloud-only and can be
omitted. `SUPABASE_SERVICE_ROLE_KEY` is required — the first-run setup uses it to
create the initial login.

> **Host networking:** the container serves on `0.0.0.0:3000` by default. If you
> run it with `--network host`, Docker sets `HOSTNAME` to the host's name and
> Next binds to *that* instead, so nothing answers on localhost — pass
> `-e HOSTNAME=0.0.0.0` in that case. Normal port mapping (`-p 3000:3000`)
> is unaffected.

> **Never point `NEXT_PUBLIC_SUPABASE_URL` at `localhost`.** That value is used
> by two callers: the browser *and* the Lens server inside the container. Inside
> a container `localhost` is the container itself, so every server-side call
> fails — first-run setup reports "Account create failed: fetch failed" while
> the browser looks fine. Use a hostname that resolves the same from both: a
> real domain in production, or the host's LAN IP when Supabase runs on the same
> machine during a proof of concept.

## Step 4 — First-run setup (create the first admin)

There's no platform-owner console in self-hosted, so the first admin is created
by the app itself. On the **first visit** to a fresh instance (no login exists
yet), Lens shows a one-time **"Set up Lens"** screen:

1. Open the instance URL. Self-hosted routes the root straight to the app (no
   marketing landing), so a fresh instance opens directly on the setup screen.
2. Fill in **workspace name**, **your name**, **email**, and a **password**.
3. Submit — this creates the workspace account and your administrator login, then
   signs you in.

From there the admin adds the rest of the team under **Settings → Team & roles**
(no seat limit in self-hosted).

The setup screen is a **single-use door**: once any login exists, `/api/setup`
returns "already set up" and the screen never appears again. It only works in the
self-hosted edition.

## Fully self-hosted: your own Supabase too

Nothing above requires Supabase's hosted service. Lens talks to a self-hosted
Supabase stack (Postgres, GoTrue, PostgREST, Storage behind the gateway) through
the same two public variables, which matters when an organisation requires
everything inside its own tenancy — an Azure/AWS VM, or on-premises hardware.

Verified end to end on 2026-09-15 against Supabase's official Compose stack:

1. `git clone --filter=blob:none --sparse https://github.com/supabase/supabase`,
   `git sparse-checkout set docker`, then in `docker/`: `cp .env.example .env`
   and `sh utils/generate-keys.sh --update-env` (generates `JWT_SECRET`,
   `ANON_KEY`, `SERVICE_ROLE_KEY`, database password — never ship the examples).
2. `sh run.sh start` — eleven services come up healthy; the API gateway listens
   on `:8000`, Studio on `:3000` (move Lens or Studio if they collide).
3. Apply the schema straight to the container:
   `docker exec -i supabase-db psql -U postgres -d postgres < supabase/schema.sql`.
   It applies unchanged, including the `auth.users` trigger and the
   `test-assets` storage policies.
4. Build Lens with `NEXT_PUBLIC_SUPABASE_URL` pointing at the gateway
   (`http://<host>:8000`, or your HTTPS domain in production) and that stack's
   `ANON_KEY`; run it with that stack's `SERVICE_ROLE_KEY`.

First-run setup, sign-in, and read/write through row-level security all behave
exactly as against Supabase-hosted. For a real deployment, put the gateway
behind TLS and set `SITE_URL` / `API_EXTERNAL_URL` in the stack's `.env` to the
public URLs — GoTrue builds its links from them.

## Updating

Apply the new SQL migrations first, then deploy the new build: source installs
pull the release and rebuild; image customers receive a new image tag (rebuilt
from the release they're moving to) and redeploy.

"New" means the files in `supabase/migrations/` dated **after the release you
are currently running** — apply them in filename order. They are idempotent, so
re-applying one you already ran is harmless, and skipping one is what breaks an
upgrade: the new code expects columns the old database lacks. Never re-run
`schema.sql` on a populated database.

> Publishing note (operator): the public community snapshot ships only the
> migrations dated on or after its first public release — that cutoff is
> `PUBLIC_SINCE` in `scripts/publish-oss.sh`, and moving it forward would strip
> upgrade steps that installed users still need.

## Editions note

The operator surface (admin console, cross-tenant onboarding, trials) is
disabled at runtime in every self-hosted build. The commercial Docker image
additionally ships as compiled bundles rather than source, and the public
community repository goes one step further: the operator code is physically
absent from that snapshot.
