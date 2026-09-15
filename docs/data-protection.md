# Lens — data protection & privacy

*Plain-English summary of how Lens stores and protects data, plus a field-level
classification. Written for review by a data-protection officer / security team.*
*Not legal advice — validate against your own policy and GDPR obligations.*

## Where data lives

- **Region:** the production database is hosted in the **EU** (Supabase, running on
  AWS EU infrastructure). Customer workspace data does not leave the EU region.
- **Encryption:** data is encrypted **at rest (AES-256)** and **in transit (TLS)** by
  the platform. Workspace AI API keys are additionally encrypted at the application
  layer (AES-256-GCM) before storage and are never returned to the browser.
- **Processor & DPA:** Supabase acts as the data processor under a Data Processing
  Agreement; the underlying infrastructure provider (AWS) is SOC 2 / ISO 27001
  certified, and Supabase is SOC 2 Type II.
- **Tenant isolation:** every account's rows carry an `account_id` and are sealed off
  by PostgreSQL row-level security. Isolation was verified by attempting cross-tenant
  reads/writes/deletes with real user tokens — all denied.

## What Lens collects (data minimization)

Creating a participant asks only for the essentials (name, email, job title,
company). Everything else — profile, product usage, tags, consent — is added
deliberately afterward, so records aren't padded with assumed data.

**Unmoderated test sessions are anonymous by design.** A participant opening a
test link is never asked for their name or email and no participant record is
created or linked. A session stores: a consent timestamp (the session only
exists after the participant accepts the consent gate), answers, task outcomes,
durations, coarse device context (viewport size and mouse-vs-touch — nothing
fingerprintable), and — when the researcher's prototype carries the tracking
snippet — click positions and page-navigation events. The snippet never
captures keystrokes, form values, or page content, and Lens still stores **no
audio or video recordings**.

**The Figma-prototype block is the one place a test loads a third party.** That
block embeds `embed.figma.com` in an iframe, so Figma receives the
participant's IP address and user agent and may set its own cookies (Figma
shows its own cookie banner inside the frame). Lens receives nothing extra from
it — Figma's Embed API only reports interaction events to viewers signed in to
Figma, so what the block records is the same self-reported outcome, comment,
duration and answers as any other task block. Two guardrails: the runner adds a
sentence to the consent gate whenever a test contains such a block ("Figma
receives your IP address and may set cookies…"), and the iframe only loads
after the participant presses **Start the prototype**, never on page load. A
test with no prototype block loads no third-party origin at all.

## Data classification

Under GDPR, once a record relates to an identifiable person, the whole record is
personal data. The practical split:

| Tier | Fields | Notes |
|---|---|---|
| **1 — Direct identifiers** | participant `firstName`, `lastName`, `email`, `phone`, avatar initials; team `profiles` (name, email) | Highest-risk personal data. Lens does **not** store audio/video recordings — only text. |
| **2 — Quasi-identifiers** | `jobTitle`, `department`, employer link, `country`, `seniority`, `yearsExperience`, `companySize`, `industry`, `language`/`timezone`, `availability`, scheduled session date/time, device/usage | Personal data as attributes of the person; can re-identify in combination |
| **3 — Free-text / research content** | interview `notes`, `aiSummary`, `keyObservations`, transcript segments & comments, highlights, insight `description`/`evidence`; unmoderated-test **open-text answers** | Personal data whenever it names or describes someone — usually does. Test answers are anonymous unless the participant volunteers personal details in free text |
| **3/4 — Test telemetry** | test-session outcomes, ratings, durations, click coordinates, screen-path events, coarse device context | Not linked to any identity (sessions are anonymous); treated as research content out of caution |
| **4 — Non-personal** | personas, tags, themes (taxonomy definitions), board columns, product/module names, counts, opaque ids, account/plan; **test definitions & design screenshots** (first-click images) | Not personal data. Screenshots are researcher-uploaded UI designs served from Supabase Storage (EU) via public-read URLs — treat the bucket as unsuitable for anything confidential |
| **Governance** | `consentStatus`, `recordingPermission`, `ndaSigned`, `recruitmentStatus`; test-session `consent_given_at` | Personal data, but the record of lawful basis you deliberately keep (test sessions only exist after explicit consent) |
| **Confidential business info** | customer **company** names/details | Usually not "personal data," but commercially confidential |

## Data-subject rights — how Lens supports them

- **Access / portability:** full export (JSON, CSV, Excel, PDF, ZIP) of a participant's
  linked data.
- **Erasure:** *Anonymize* strips a participant's personal data (name, email, phone)
  while keeping the de-identified research; full *Delete* cascades and removes the
  record and its interviews. Unmoderated test sessions can be deleted individually
  from the results page (manager-only), and deleting a test removes all of its
  sessions; both are recorded in the audit trail.
- **Rectification:** every field is editable inline on the detail pages.
- **Consent:** consent status, recording permission, and NDA are tracked per
  participant. When "require explicit consent" is enabled, the app blocks creating
  an interview for a participant who hasn't granted consent.
- **Accountability:** role-based access control (admin / researcher / designer /
  product-owner / viewer) limits who can see and change what. Security- and
  GDPR-relevant actions (exports, erasure, consent changes, role/AI-policy
  changes, member management) are recorded in an **append-only audit trail**
  (`audit_events`): members can only insert events for their own account, only
  admins can read them, and there are no update/delete policies — the log is
  immutable from clients. Admins browse it in Settings → Audit log (searchable,
  filterable, paginated). Recording is always on; *viewing* the log is a Team-plan
  feature.

## Sub-processors

- **Supabase (AWS, EU)** — database, auth. All customer workspace data.
- **Hetzner Online GmbH (Germany, EU)** — hosts the application server (via a
  Coolify instance). Processes data in transit; the database itself lives in
  Supabase.
- **Figma (Figma, Inc., US)** — *only* for tests that contain a Figma-prototype
  block, and *only* from the participant's browser: the embedded prototype is
  loaded directly from `embed.figma.com` after the participant presses Start, so
  Figma sees their IP address and may set cookies. Disclosed in the consent gate
  automatically. No workspace data is sent to Figma, and researchers who can't
  accept a US recipient can use an App task block instead (self-hosted
  prototype, no third-party frame). The **demo sandbox** contains one such test
  ("Prototype walkthrough"), pointing at Figma's own public example file — so
  it is the only third-party origin the demo can load, and only if a visitor
  starts that block.
- **Anthropic / OpenAI / xAI / Google** — *only* if a workspace configures an AI
  key, *only* for the content sent to a requested AI action, with a PII-redaction
  option, and it is **off by default** (and disabled entirely in the demo sandbox).
  This includes the app-task **behavioral diagnosis**: what's sent is an
  aggregate brief (outcome counts, anonymized screen paths, element selectors,
  click/rage counts, layout mix) plus free-text answers run through the same
  PII redaction — never raw per-session records, and never form values or
  keystrokes (the beacon does not collect those).

The public-facing versions of this list live on the cloud service's
[privacy page](https://lensresearch.app/privacy) and in the compliance & legal
pack the platform owner generates at `/admin/compliance` (cloud operator
console; includes a DPA draft and an internal checklist).

## Retention & deletion

Consent records carry an expiry and a retention period. Erasure is available on
demand today — per participant (anonymize / delete) and via data-subject
requests. Exports can be anonymized by default (a workspace toggle): participant
identifiers are replaced by stable pseudonyms **deep through the export** —
ids, cross-references, and free-text name mentions are all scrubbed, in every
format (JSON, CSV, Excel, PDF, ZIP). **Scheduled** retention enforcement is
**planned** (it needs a server-side job) and not yet active. Deleting an
account cascades to remove all of its data.

## Baseline vs. optional hardening

**Baseline (in place):** EU hosting, platform encryption at rest + in transit, tenant
isolation via RLS, DPA-backed processor, RBAC, consent/anonymize/DSR tooling,
data minimization. This matches the posture of established repositories (e.g. Condens,
Dovetail), which likewise use a compliant EU-region cloud rather than storing PII in
each customer's own tenant.

**Optional, for stricter policies (not required for the baseline):**
- Application-layer encryption of Tier-1 identifiers with a **customer-managed key**
  (e.g. Azure Key Vault BYOK).
- **Microsoft / Entra ID SSO.**
- Keeping identifiers in the customer's **own tenant** (M365 list / Dataverse) or
  **self-hosting** the database — only if a policy literally requires data to reside
  in the customer's infrastructure.

## Operational notes

- The Supabase `service_role` key and `AI_KEY_SECRET` are server-side only, never
  shipped to the browser.
- Preferences and the demo sandbox never write customer data to the shared database.
