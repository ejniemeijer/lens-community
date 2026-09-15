# Unmoderated testing — design proposal

Status: **proposal, agreed 2026-07-21** — not yet implemented.
Revised same day: **Figma prototype embedding dropped** in favor of
vibe-coded live apps (Figma Make, Claude Design, Lovable, v0, Bolt, staging
builds) — see "Considered and dropped" at the end for why.
Partly reversed 2026-07-27: an **embed-only `figma-proto` block shipped**
(no Embed API, no click telemetry) — see "Figma prototype block" at the end.

Scope: Maze/Useberry-style unmoderated tests built from blocks, shared via an
anonymous public link, with results landing back in Lens.

## Concept

A researcher creates a **test** inside a project. A test is an **ordered list
of blocks** (same builder model as Useberry):

| Block type | What the participant sees | What we capture |
|---|---|---|
| **Message** | Intro / context / thank-you text (intro doubles as the consent gate) | consent timestamp, time on block |
| **Questions** | Rating scales and open-text questions | answers |
| **First Click** | A static image (screenshot of a design) + "Where would you click to …?" — one click ends the block | exact click coordinates + time-to-click, from 100% of participants → **heatmap** |
| **Live app task** | Task instructions + a "Start task" button that opens **any URL in a new tab** — a Figma Make app, a deployed Claude Design prototype, a Lovable/v0/Bolt app, a staging env, or the live product. The runner tab keeps the instructions and "Task complete" / "Give up" controls | self-reported outcome + duration always; **full click/page telemetry and auto success detection when the app carries the Lens beacon snippet** |

Publishing generates a tokenized public link (`/t/<token>`). The researcher
distributes it however they like — **no participant management, no panel, no
invitations**. Sessions are anonymous. When a participant finishes (or
abandons — partial data is flushed on page close), results appear on the
test's results page.

## Tracking model: the Lens beacon

The strategic bet: prototypes worth testing are increasingly **real generated
web apps** (vibe-coding output), and because the researcher controls that
code, we can get *first-party quality telemetry* without depending on any
vendor's embed API.

**The snippet.** A ~5-line `<script>` the researcher pastes into their app —
or, for AI-built apps, a one-line prompt ("add this tracking snippet to every
page") shown in the builder next to a copy button. It:

1. Reads `?lens=<sessionId>.<sessionToken>` from the URL on first load and
   stashes it in `sessionStorage` (so it survives client-side routing).
2. Batches events — page/route views, clicks with element selector +
   normalized coordinates — and `POST`s them to
   `/api/t/<token>/events` every few seconds and on `pagehide` via
   `navigator.sendBeacon`.

**The flow.** The runner opens the block's URL in a new tab with the `?lens=`
param appended. Telemetry streams in while the participant works; back in the
runner tab they confirm "Task complete" or "Give up". If a beacon event
matches the block's `successUrlPattern` (e.g. `/confirmation*`), the outcome
is upgraded to `success-auto` — **route matching is the success criterion**,
which is more robust and more natural for researchers than any node-id-style
mechanism.

**Two layers, honestly labeled:**

1. **Guaranteed layer** (every participant, every block type): answers,
   self-reported outcomes, per-block durations, drop-off point, First Click
   coordinates.
2. **Beacon layer** (live-app blocks whose app carries the snippet): click
   streams, page paths, misclick-ish signals (clicks on non-interactive
   elements), auto success. Works for **100% of participants** — no
   third-party login required — because it's our code talking to our
   endpoint.

**Per-tool notes:**

- **Figma Make** — publish the app, prompt the snippet in. Cannot be
  iframed (CSP), which is why the block opens a new tab.
- **Claude Design** — generates real HTML/CSS/JS and can build with your own
  design-system components from a repo. Hosted claude.ai share links block
  external requests (strict CSP), so the beacon requires exporting/deploying
  the code somewhere you control (Vercel, staging box, …).
- **Lovable / v0 / Bolt / hand-built staging** — deployable code, snippet
  pastes straight in.
- **Live product** — works too; treat as a normal analytics-snippet
  situation and mind what pages participants can reach.

## Schema — two tables

Follows repo conventions: text PKs, `account_id text not null` + FK +
`_account_idx`, `created_at timestamptz not null default now()`, idempotent
migration in `supabase/migrations/` folded into `schema.sql`.

Blocks live as **jsonb on `tests`** (only ever edited as a unit in the
builder). Session results are **jsonb on `test_sessions`** keyed by block id.

```sql
create table if not exists public.tests (
  id text primary key,                    -- "ut-checkout-flow"
  account_id text not null,               -- FK/default/index per convention
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  share_token text not null unique,       -- 24+ char crypto-random; rotatable
  blocks jsonb not null default '[]',     -- ordered block list, see below
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.test_sessions (
  id text primary key,                    -- server-generated "ts-<random>"
  account_id text not null,
  test_id text not null references public.tests(id) on delete cascade,
  session_token_hash text not null,       -- hash of per-session write secret
  status text not null default 'started' check (status in ('started','completed','abandoned')),
  consent_given_at timestamptz not null,  -- row only exists after consent
  device jsonb,                           -- coarse only: viewport, touch/mouse
  results jsonb not null default '{}',    -- {blockId: {...}}, merged per block
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
```

**RLS.** `tests`: the standard two policies (`read own account` select;
`manage own account` all, gated on `can_manage_content()`). `test_sessions`:
RLS enabled with only a `read own account` select policy plus a
manager-only **delete** policy (erasure); **no client insert/update** — all
writes go through service-role API routes (the `access_requests` posture).

**Blocks jsonb shape:**

```jsonc
[
  { "id": "b1", "type": "message", "title": "Welcome", "bodyMd": "...",
    "isConsentGate": true, "consentText": "..." },
  { "id": "b2", "type": "questions",
    "questions": [
      { "id": "q1", "type": "rating", "prompt": "…", "scale": 5 },
      { "id": "q2", "type": "open",   "prompt": "…" } ] },
  { "id": "b3", "type": "first-click",
    "instructions": "Where would you click to create a new job?",
    "imageUrl": "…", "imageWidth": 1440, "imageHeight": 900,
    "followUpQuestions": [] },
  { "id": "b4", "type": "app-task",
    "instructions": "Create a new job in the app that opens.",
    "url": "https://…figma.site/…",        // Make, Claude Design deploy, staging…
    "successUrlPattern": "/job-created*",   // beacon route match ⇒ success-auto
    "followUpQuestions": [ /* same shape as questions */ ] }
]
```

**Session results jsonb shape** (per block id):

```jsonc
{
  "b2": { "answers": { "q1": 4, "q2": "Couldn't find the button" }, "durationMs": 21000 },
  "b3": { "click": { "x": 0.31, "y": 0.62 },  // normalized 0–1 against image size
          "timeToClickMs": 3400, "answers": {} },
  "b4": { "outcome": "success-auto",          // success-auto | success-reported | gave-up | skipped
          "durationMs": 61000,
          "beaconEvents": [                    // capped; empty if app has no snippet
            { "t": 0,    "type": "page",  "path": "/" },
            { "t": 4200, "type": "click", "path": "/", "sel": "button.new-job",
              "x": 0.72, "y": 0.18 } ],
          "answers": {} }
}
```

**First Click images — new dependency: Supabase Storage.** Lens stores no
media today. First Click needs the image reachable by anonymous
participants, so: a `test-assets` bucket, uploads account-scoped
(`{account_id}/{test_id}/…`, authenticated upload policy), public read.
Paste-a-URL is the fallback for self-hosted installs that skip Storage.

## Store & sync integration

- `tests` is a full store citizen: `lib/types.ts` interface, `DB.tests` +
  add/update/delete actions, `FieldMap` entry in `M`, `LOAD_ORDER` /
  `WRITE_ORDER` slot (after `projects`), `CloudSnapshot`/`SyncInput` fields.
- `test_sessions` is **deliberately excluded from the sync mirror** — the
  mirror's upsert-then-delete-removed would clobber concurrent participant
  writes. The results page queries sessions read-only via the browser
  Supabase client (RLS select covers it). Same reason `access_requests`
  isn't mirrored.
- **Promote to insight** mirrors the affinity board: build an `Insight` with
  `uid("in")`, evidence text from the stat ("7/10 failed the create-job
  task, avg 94 s"), `projectIds` from the test, then `addInsight(insight)` —
  landing off-board until staged into the `workflowStage` pipeline.

## Route map

Researcher (authenticated; top-level pages filtered by project, like
kanban/affinity):

| Route | Purpose |
|---|---|
| `app/tests/page.tsx` | Test list + create |
| `app/tests/[id]/page.tsx` | Block builder: sidebar of blocks, per-block config, beacon snippet + AI-prompt copy buttons on app-task blocks, publish/close, copy link |
| `app/tests/[id]/results/page.tsx` | Funnel across blocks, per-question answers, First Click heat overlay, app-task outcomes + page paths + click detail per session, promote-to-insight |

Participant (public; `proxy.ts` + lock screen exempt `/t` and `/api/t`):

| Route | Purpose |
|---|---|
| `app/t/[token]/page.tsx` | Runner: walks the blocks; opens app-task URLs in a new tab with `?lens=` appended; flushes per block + `sendBeacon` on unload |
| `GET  /api/t/[token]` | Service-role: validate token + `status='active'`; return sanitized definition (no tenant fields) |
| `POST /api/t/[token]/session` | Service-role: record consent, create session, return `{sessionId, sessionToken}` |
| `PATCH /api/t/[token]/session` | Service-role: merge one block's result into `results`; requires `sessionId` + `sessionToken` (compared against hash); payload caps per the `request-access` validation style |
| `POST /api/t/[token]/events` | Service-role, **CORS-open** (`Access-Control-Allow-Origin: *` on this route only — auth is the session token, not the origin): append beacon events to the active app-task block; hard caps (≤ 2000 events/session, batch ≤ 50, strings length-capped); rejects if session completed or test closed |

No rate-limiting infra exists in the repo; token + per-session secret +
payload caps are the guard. A simple in-memory throttle on session creation
is a cheap later add.

## GDPR

- Consent is a gate, not a step: nothing is written before the participant
  accepts; `consent_given_at` recorded on the session.
- Sessions are fully anonymous — no participant records are created or
  linked. Only open-text answers can contain personal data (tier 3 free
  text, covered by existing classification).
- Beacon events are click/route telemetry on the researcher's own prototype
  — no content capture, no keystrokes, no form values. State this in the
  snippet docs and keep the snippet that simple on purpose.
- Erasure: sessions cascade-delete with their test; managers can delete
  individual sessions. Closing a test stops collection immediately (both
  token validation and the events route check `status`).
- `docs/data-protection.md`: add classification rows for click/path
  telemetry (tier 3–4) and test-asset screenshots; the existing "no
  audio/video recordings" claim is unchanged.

## Plan gating

MVP ships one narrow gate: **concurrent live-test count** — `starter` = 1,
`team` = 10, unknown plans (`business`, self-hosted, local, demo) uncapped —
via `PLAN_LIVE_TEST_LIMITS` / `liveTestLimitFor()` in `lib/permissions.ts`,
enforced at publish, client-side like the existing settings gates. Drafts and
closed tests never count. `"test-analytics"` is the `PlanFeature` string for
the analytics views (in `TEAM_FEATURES`; Starter sees basic results only).
Recording and basic results always work on every plan.

## Phases

**Phase 0 — beacon spike (small).** Publish a throwaway Figma Make app,
prompt the snippet in, verify: `?lens=` param survives publish/routing,
CORS `POST` from `*.figma.site` reaches a local endpoint, `sendBeacon` fires
on tab close. Repeat once with a deployed Claude Design export. No vendor
registration of any kind required.
_Status 2026-07-21: **phase 0 complete.** Local run verified cross-origin
POST, session persistence, click/route capture, and exit `sendBeacon`;
Erik's Figma Make run confirmed the snippet survives publish and a
published `*.figma.site` app delivers events end-to-end (Chrome; Safari
blocks `https→http://localhost` as mixed content — dev-only issue, see
`spikes/beacon/README.md` findings). Snippet v0 lives in `spikes/beacon/`
and seeds the production snippet in phase 1._

**Phase 1 — MVP.** Migration + schema.sql fold-in; types + store/sync wiring
for `tests`; builder with the four block types (incl. Storage bucket for
First Click images); public runner + the four `/api/t/[token]` routes +
proxy exemption; the beacon snippet (versioned, served from
`public/`); results page with First Click heat overlay, app-task paths +
outcomes, promote-to-insight; data-protection doc update; active-test gate.

**Phase 2.** _Status 2026-07-21: the first analytics slice is **shipped**
(Team-gated via `planHasFeature("test-analytics")`): first-click density
heatmaps, per-route element click maps with rage-click detection, and
event-based session replay — all from existing beacon data._

**Investigated 2026-07-21 — the Useberry embed trick.** Useberry shows Figma
Make apps inside an iframe by **mirroring the published app onto their own
proxy domain** (`ubtag<host-encoded>.p.useberry.com`): they fetch/cache the
static bundle at import time, serve it with no frame-blocking headers, and
**auto-inject their tracking script** into the HTML. Verified empirically:
the proxied copy even keeps serving after the original figma.site URL 404s.
The equivalent Lens feature ("proxy embed mode") would give us: iframe panel
UX for every target incl. Make, automatic beacon injection (no manual
snippet paste), and precise task timing. Costs: a wildcard-subdomain proxy
(`*.p.<domain>` DNS + TLS; path-based proxying breaks root-absolute asset
URLs), HTML rewriting + caching infrastructure, mirrored-copy retention
questions in the data-protection doc, and it should stay scoped to the
researcher's own prototypes. Self-hosted keeps the snippet path as
fallback. This is the biggest-value phase-3 candidate.

Remaining backlog, roughly by priority:

1. Robustness round: session-create throttle on the public API; per-session
   drill-down on the results page; results export through the existing
   (anonymizing) export tooling; test duplicate/templates; self-hosting
   docs note (bucket migration + public HTTPS origin for the beacon).
2. Block types: preference test, five-second test (both reuse the
   `test-assets` bucket), group & randomize (results stay keyed by block
   id, so aggregation survives shuffling).
3. Deeper analytics: beacon v2 (scroll offsets + document-relative
   coordinates) → researcher-uploaded per-route screenshots with click
   overlays; cross-session route funnels; AI summary of open answers via
   the existing AI layer.
   **AI behavioral "why" diagnosis (shipped 2026-07-22):** per app-task
   block, `buildDiagnosisBrief` (lib/tests-diagnosis.ts, pure) distills the
   telemetry into a PII-light brief — outcome counts, screen journeys split
   by succeeded-vs-gave-up, top clicks with rage/nav counts, desktop/mobile
   mix, and redacted free-text — then components/tests/ai-diagnosis.tsx runs
   it through `askAIJson` for an evidence-anchored diagnosis (why people
   struggled + a fix), with one-click promote-to-insight. Gated on
   `test-analytics` (Team) + `use-ai` + a configured key + ≥5 sessions with
   click data. Ephemeral (re-run on demand); per-block; first-click blocks
   and a test-level roll-up are future adds.
   **Generate-a-test-from-a-prompt (shipped 2026-07-22):** builder "Generate
   with AI" — the model returns a constrained *intent* schema (lib/tests-ai.ts
   GeneratedTest), and `buildBlocksFromGenerated` constructs valid blocks
   locally (real ids via injected `uid`, safe defaults, media left blank) so a
   hallucinated shape can't corrupt the test. Gated on manage-content + use-ai
   + key; strips a second consent gate on append.
   **Summarize open answers (shipped 2026-07-22):** per open/input question in
   the results, `QuestionResults` offers an AI theme summary (redacted
   verbatims → summary + themes with example quotes). Gated on use-ai + key
   only — **all plans** (Starter included), so basic text AI is universal while
   behavioral AI stays Team. Beacon v3 (shipped 2026-07-22) additionally
   records the participant's layout in px per click — viewport (`vw`/`vh`)
   and full document (`dw`/`dh`) — the data prerequisite for
   breakpoint-filtered heatmaps and a size-faithful live-app overlay
   (iframe sized to `dw`×`dh` so it never scrolls internally; blocked on
   Figma Make until proxy embed mode, works where embedding is allowed).
4. Distribution: optional participant linking (`?p=` links respecting
   `consent_status`); multiple source-tagged share links per test.
5. Scale/platform (build when usage demands, not speculatively): raw
   events table if the 2000-events/session jsonb cap binds; RPC jsonb
   merge if the PATCH/beacon write race loses batches in practice;
   server-side plan enforcement (belongs to a repo-wide effort); scheduled
   session retention (ties to the planned retention job).

**Parked — own decision, not a backlog item:** rrweb DOM replay. True
pixel replay breaks the "no keystrokes, no form values, no content" claim
in docs/data-protection.md unless masking is on by default, the consent
text changes, and sessions get chunked storage (rrweb payloads are MBs).
Price in the GDPR work before committing.

**Workflow per step:** implement → `tsc --noEmit` → verify against the dev
server on port 3000 (never start a second one) → summarize → commit only on
explicit "push it".

## Known risks

1. **Snippet is a manual step** — an app without it silently yields
   self-report-only data. Mitigate in the builder: a "beacon check" that
   pings the entered URL flow (researcher opens their app via a test link;
   builder shows "beacon received ✓") before publish.
2. **New tab = less control** — we can't see abandonment inside a
   snippet-less app; a participant who never returns is recorded as
   drop-off on that block. The beacon closes most of this gap.
3. **CORS-open events route** invites junk traffic — auth is the
   per-session token, plus hard caps and `status` checks; accept the
   residual noise risk for MVP.
4. **Supabase Storage is new infra** for this repo — smallest possible
   surface (one bucket, public read, account-scoped paths), URL-paste
   fallback.
5. **jsonb growth** — beacon events append into `results`; caps keep a
   session bounded (~2000 events); move to a raw events table in phase 2 if
   real usage pushes against it.

## Considered and dropped: embedded Figma prototypes

Investigated in depth 2026-07-21; dropped by decision, not oversight.
Summary for posterity:

- Figma **Embed Kit 2.0** can embed prototypes inline and emit
  `PRESENTED_NODE_CHANGED` / `MOUSE_PRESS_OR_RELEASE` events (screen paths,
  misclicks) — but **events only fire for viewers logged into Figma**
  (support-confirmed Jan 2026), making them useless for anonymous
  participants; Maze/Useberry work around this only via private Figma
  partnerships. Also required: an OAuth-app client-id + statically
  allowlisted embed origins (a per-install problem for self-hosted).
- **Figma Make cannot be iframed at all** (CSP `frame-ancestors 'self'`),
  which forced the new-tab pattern — and the new-tab + beacon pattern
  turned out strictly better: 100% participant coverage, tool-agnostic,
  route-match success detection.
- If a Figma-prototype block is ever revisited (e.g. Figma opens events to
  allowlisted origins for anonymous viewers), the block model absorbs it as
  just another block type; see git history of this file for the full
  embed-based design.

## Figma prototype block (shipped 2026-07-27)

Re-checked the blocker before building: still current. Figma support, 7 Jan
2026, on the open forum thread: the Embed API requires a logged-in Figma user,
and they are "evaluating" letting allowlisted embed origins work for anonymous
visitors. No changelog since.

What the 2026-07-21 decision conflated is that **embedding works anonymously;
only the event API doesn't.** So `figma-proto` ships as an embed-only block:

- **Measures** time on task, self-reported outcome, the participant's own words
  (`outcomeComment`), and follow-up answers — the same result shape as an
  app-task block minus `beaconEvents`. Results reuse the app-task outcome bar
  (`OutcomeBar`/`OutcomeComments`, extracted for both) with a standing note that
  click paths need an App task block.
- **Two task types** (`taskType`), matching the split Maze/Useberry offer:
  `goal` (default) asks for a completed / couldn't-do-it outcome; `explore`
  drops the success framing entirely — the participant looks around and the
  questions carry the result, so publish requires at least one question and the
  results panel shows visits + median time instead of an outcome bar (an empty
  outcome bar would read as "nobody finished" rather than "there was nothing to
  finish"). Switching to explore seeds a starter question rather than warning.
- **What is *not* offered: goal screen and exact path.** Both need to know which
  frame the participant is on, which is the signal Figma withholds from
  anonymous viewers. Maze's version of this almost certainly doesn't use Figma's
  player at all — the "Refresh prototype" re-sync, the screen thumbnails grouped
  by flow start, and a Figma-badged "Enable interactive components" toggle all
  point at importing the file through the REST API and **rebuilding the
  prototype in their own player** (inference from their UI, not verified
  internals; the API-only constraint leaves little else). Matching it means
  workspace-level Figma auth, traversing the file JSON for frames and prototype
  interactions, rendering and caching every frame, runtime hotspot hit-testing,
  then goal/path evaluation — plus permanent fidelity debt against smart
  animate, variables/conditionals, interactive components and overlays. Note
  that Lens **already has goal-based success detection** where it owns the
  signal: `successUrlPattern` on an App task auto-upgrades the outcome when the
  beacon reports a matching route. The capability isn't missing; Figma
  prototypes just have no routes. Don't build the player until real prospects
  ask for it by name.
- **Never iframes a researcher-typed string.** `lib/tests-figma.ts` (pure)
  parses the pasted link — accepting `/proto/`, `/design/`, `/file/`, an
  `embed.figma.com` URL, or a whole pasted `<iframe>` snippet — and rebuilds an
  `embed.figma.com/proto/<key>` URL from the parsed key. Anything else yields
  null and the runner degrades to "open in a new tab". Publish is blocked on a
  non-Figma link.
- **Embed params:** `footer=false`, `viewport-controls=false`, `hide-ui=1`
  (undocumented for proto embeds but verified live — drops Figma's
  prev/next/restart overlay, which would otherwise let a participant page
  through screens without touching the design), `scaling=contain`,
  `content-scaling=fixed`, `hotspot-hints=false` (they tell the participant
  where to click — that's the question, not the answer) and
  `device-frame=false` (the bezel only eats stage space the design could use;
  verified working before it was dropped, so this is a decision, not a
  limitation). Both of those default to *true* at Figma's end and so must be
  sent explicitly. All fixed, not exposed: each is a measurement decision with
  a right answer. The one researcher control is the stage aspect
  (phone/tablet/desktop).
- **Layout.** Pressing Start hands the whole viewport to `ProtoStage`: the
  prototype takes the screen and the task, questions and chrome move into a
  380px side panel (stacked above the prototype below `lg`, where the block's
  aspect ratio drives the height instead). The stage box is capped at
  `100dvh × aspect`, so the stage-size preset stops a phone prototype from
  sitting in a letterbox stretched across a wide monitor — measured: on a
  1440×860 viewport a desktop preset fills the available 777px, a phone preset
  caps at 397px. Everything else in the runner keeps the centered
  `max-w-2xl` reading column.
- **The sharing trap, and the fix.** A *private* prototype embeds fine for the
  signed-in researcher and shows a permission wall to participants. The builder
  therefore asks Figma the way an anonymous participant would, server-side, via
  Figma's public **oEmbed** endpoint (`/api/tests/check-figma`): 200 + file
  title when the link is viewable by anyone, 4xx when it isn't. This is the one
  check that can't be replaced by looking at the builder preview.
- **Third-party disclosure.** The iframe loads only after the participant
  presses Start, and the consent gate gains an automatic sentence whenever a
  test contains such a block — so existing tests stay accurate the moment one
  is added, without editing their consent text. Figma is listed as a
  sub-processor in docs/data-protection.md and on `/privacy`.
- **Known cosmetics:** Figma shows its own cookie banner inside the frame on
  first load, and the builder's glance panel is `pointer-events-none`, so it
  always shows the block's start screen — the editor's own live preview is
  where the researcher sees the prototype.
- **If Figma opens events to anonymous viewers**, this block absorbs it: add
  `client-id` + a registered embed origin and read `PRESENTED_NODE_CHANGED` /
  `MOUSE_PRESS_OR_RELEASE` into the existing results shape. Per-install origin
  allowlisting stays the open problem for the self-hosted edition.
