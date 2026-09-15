# AI features

Lens includes optional, AI-assisted features that help researchers see patterns
faster. They are designed around three principles:

1. **Grounded, not trained.** The model only ever sees the data you send it at
   request time (a snapshot of the relevant repository content). Your research is
   never used to train a model.
2. **Assists, never decides.** AI output is clearly labelled and always editable.
   It supports the researcher's judgment; it does not replace it.
3. **Off-switchable and key-per-workspace.** Every feature can be turned off, and
   the model runs on your own provider key.

This document is for operators and workspace admins: what the features are, how
they are wired, how to configure them, and how data is handled.

---

## How it works

The browser never talks to the AI provider directly. All calls go through a
server proxy so keys and requests stay server-side where possible:

```
client (lib/ai.ts) ──▶ /api/ai (app/api/ai/route.ts) ──▶ Anthropic / OpenAI / xAI / Google
```

- `lib/ai.ts` exposes `askAI` (one-shot), `askAIJson` (JSON result with one
  retry), and `streamAI` (token streaming).
- `app/api/ai/route.ts` is the proxy. `GET` reports which providers have a
  server-side environment key; `POST` runs the completion.
- `app/api/ai/key/route.ts` stores/reads the workspace's shared per-provider
  key — one key per account, set by an admin (cloud mode only).
- `lib/ai-context.ts` builds the grounding context that gets sent
  (`workspaceSnapshot`, `projectSummaryContext`, `interviewSummaryContext`,
  `suggestionsContext`) and runs PII redaction on it.

## Providers & models

Configured in **Settings → AI configuration** (admins only). Defined in
`AI_PROVIDERS` in `lib/ai.ts`:

| Provider | Models |
| --- | --- |
| **Claude (Anthropic)** | Claude Opus 4.8 *(recommended)*, Claude Sonnet 5, Claude Haiku 4.5 |
| **ChatGPT (OpenAI)** | GPT-4o *(recommended)*, GPT-4o mini, GPT-4.1, GPT-4.1 mini |
| **Grok (xAI)** | Grok 4 *(recommended)*, Grok 3, Grok 3 mini |
| **Gemini (Google)** | Gemini 2.5 Pro *(recommended)*, Gemini 2.5 Flash, Gemini 2.0 Flash |

## API keys — how a key is resolved

A workspace is "configured" when a usable key is found. Resolution differs by
backend (see `checkAiConfigured` in `lib/ai.ts`):

- **Local mode** (localStorage prototype): the key is entered in Settings and
  stored **in that browser only**. It rides along in the request body to the
  proxy.
- **Cloud mode**: the client never sends the key. The proxy uses either
  - the **workspace key** an admin saved server-side (`/api/ai/key`,
    encrypted at rest with `AI_KEY_SECRET`), or
  - a **server environment key** (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` /
    `XAI_API_KEY` / `GEMINI_API_KEY`).
- **Demo sandbox**: AI is reported as *not configured* on purpose — the proxy
  requires a signed-in team account, so demo sessions get a friendly "sign in
  to use AI" message rather than an auth error.

## The features

Everything below is real and calls the configured provider. Each is gated by a
toggle in **Settings → AI configuration → Assisted features** and by the
`use-ai` capability (see *Access control*).

| Feature | Where | What it does |
| --- | --- | --- |
| **AI Assistant** | `/ai` | A chat grounded in a snapshot of your repository. Answers questions about your research, with quick-prompt starters. Streamed. |
| **Suggestions** | `/ai` (Generate / Refresh) | Scans your data and surfaces patterns: themes, tags, personas, topics, plus duplicates/similar, opportunities, and research gaps (each pattern kind is toggle-gated). |
| **Summarize interview** | interview page | Produces a summary, key observations, and (if enabled) an overall sentiment. All fields stay editable. |
| **AI executive summary** | project page | A streamed executive summary of a project, grounded in its insights. |
| **Affinity clustering** | affinity board | Groups notes into 3–6 candidate themes you can accept or rearrange. |
| **Kanban lane suggestions** | kanban board | Proposes a triage lane per insight; accept per card or apply all. |

## Assisted-features toggles

Each toggle gates a real feature. Turning one off removes the corresponding UI
or narrows what the suggestions engine returns.

| Toggle | Controls |
| --- | --- |
| **Interview & executive summaries** (`ai.summaries`) | The "Summarize with AI" button on interviews and the AI executive-summary generator on projects. |
| **Suggested themes & tags** (`ai.suggestions`) | The whole suggestions engine (the Generate/Refresh button and affinity-board clustering). Master switch for suggestions. |
| **Duplicate & similar detection** (`ai.duplicates`) | Whether the suggestions engine emits `duplicate` / `similar` kinds. |
| **Opportunity detection** (`ai.opportunities`) | Whether the suggestions engine emits the `opportunity` kind. |
| **Sentiment analysis** (`ai.sentiment`) | Whether the interview summarizer sets an interview's sentiment. |
| **Research gap analysis** (`ai.gaps`) | Whether the suggestions engine emits the `gap` kind. |
| **Kanban lane suggestions** (`ai.triage`) | The "Suggest lanes" action on the Kanban board. |
| **Auto-transcribe uploads** (`ai.transcribe`) | **Planned.** No upload-transcription pipeline exists yet; shown as a disabled "Planned" row. |
| **Redact PII before sending to AI** (`ai.redact`) | Strips emails and phone numbers from context before it is sent to the model. |

## Access control

AI is gated by the `use-ai` capability in `lib/permissions.ts`:

```
"use-ai": ["admin", "researcher", "designer", "product-owner"]  // everyone except viewer
```

- **Viewers** get no AI: the AI Assistant nav item is hidden, `/ai` shows "Not
  available for your role", and the dashboard "Ask AI" shortcut is suppressed.
- **Per-member switch:** an admin can turn AI off for a specific member
  (Settings → Team, `profiles.ai_enabled`) — enforced by the proxy and every
  AI surface. Per-member control and the token-usage analytics card are part
  of the **Team plan** (AI governance); on Starter, usage is still metered,
  only the controls are locked.
- **AI configuration** (provider, model, keys, toggles) is **admin-only**.
- **Usage metering:** the proxy records per-member token totals in `ai_usage`
  after every call, shown in Settings → AI (Team plan).

## Privacy & data handling

- **What is sent:** only the context needed for the request — a repository
  snapshot for the assistant/suggestions, the interview material for a
  summary, or the notes for clustering. Built in `lib/ai-context.ts`.
- **Redaction:** with **Redact PII** on (the default), emails and phone numbers
  are stripped from that context before it leaves the server.
- **Not training data:** the provider is used for inference only. Treat the
  provider as a **sub-processor** and reflect it in your DPA / sub-processor
  list.
- **Key storage:** local-mode keys live in the user's browser; cloud-mode
  workspace keys are stored server-side encrypted (AES-256-GCM) or supplied via
  environment variables — never sent from the client.

## Environment (self-hosting)

For a server-wide key (used when no workspace key is set), set the relevant
variable in your deployment environment:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GEMINI_API_KEY=...
```

See [`.env.example`](../.env.example) for every variable and
[`docs/self-hosting.md`](./self-hosting.md) for the full build & run setup.

## Troubleshooting

- **"AI isn't configured yet"** — no usable key for the active provider. Add one
  under Settings → AI configuration, or set the environment key.
- **AI features disabled in the demo** — expected; sign in with a team account.
- **A feature's button is missing** — check its Assisted-features toggle, and
  confirm the user's role has the `use-ai` capability (viewers don't).
- **"The AI returned an unexpected format"** — a JSON parse failure after one
  retry; re-run. If persistent, try a more capable model.

## Not yet built (Planned)

- **Auto-transcribe uploads** — turning audio/video uploads into transcripts.
  There is no transcription pipeline yet; the toggle is shown as a disabled
  "Planned" row so the UI doesn't over-claim.
