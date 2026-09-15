import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret, aiKeySecretConfigured } from "@/lib/server/crypto";

/**
 * Server-side proxy to an LLM provider. Anthropic Claude uses its own Messages
 * API; OpenAI, Grok (xAI), and Gemini (Google) all speak the OpenAI Chat
 * Completions format, so they share one code path with a per-provider base URL.
 * The key is resolved in this order: (1) supplied per-request by the client —
 * only used in local mode, where the key lives in the browser; (2) the
 * workspace's shared key, stored encrypted in public.account_ai_keys and
 * decrypted here (cloud mode); (3) a server key from the environment. When
 * Supabase is configured a signed-in user is required so this can't be an open proxy.
 *
 * GET  → { anthropic, openai, xai, google: boolean }  — which providers have a server key
 * POST → streamed text, or { text } when stream:false
 */

type Provider = "anthropic" | "openai" | "xai" | "google";
const PROVIDERS: Provider[] = ["anthropic", "openai", "xai", "google"];
const isProvider = (v: unknown): v is Provider => PROVIDERS.includes(v as Provider);

const ANTHROPIC_VERSION = "2023-06-01";

const ANTHROPIC_MODELS: Record<string, string> = {
  "claude-opus-4-8": "claude-opus-4-8",
  "claude-sonnet-5": "claude-sonnet-5",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

/** OpenAI-compatible providers: same request/stream/usage shape, different host. */
const OPENAI_COMPAT: Record<Exclude<Provider, "anthropic">, { label: string; url: string; models: Set<string>; default: string }> = {
  openai: {
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    models: new Set(["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"]),
    default: "gpt-4o",
  },
  xai: {
    label: "Grok (xAI)",
    url: "https://api.x.ai/v1/chat/completions",
    models: new Set(["grok-4", "grok-3", "grok-3-mini"]),
    default: "grok-4",
  },
  google: {
    label: "Gemini (Google)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: new Set(["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]),
    default: "gemini-2.5-pro",
  },
};

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  xai: "Grok (xAI)",
  google: "Gemini (Google)",
};

const ENV_VAR: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  xai: "XAI_API_KEY",
  google: "GEMINI_API_KEY",
};

/** Strip surrounding quotes, stray whitespace, and anything after the first
    token (URLs and keys never contain spaces, so accidentally pasted extra
    terminal lines are dropped safely). */
const cleanEnv = (v?: string) => {
  const t = v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0];
  return t || undefined;
};

const envKey = (provider: Provider) => cleanEnv(process.env[ENV_VAR[provider]]);

export async function GET() {
  return NextResponse.json(
    Object.fromEntries(PROVIDERS.map((p) => [p, Boolean(process.env[ENV_VAR[p]])])),
  );
}

/** When Supabase is set up, require a valid access token and return the auth
    user id. In local/dev mode (no Supabase) there's no auth layer. */
async function authedUid(req: Request): Promise<{ uid?: string; error?: string }> {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anon) return {}; // local/dev mode — no auth layer
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in." };
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { error: "Not signed in." };
  return { uid: data.user.id };
}

/** The caller's account id + whether an admin has enabled AI for them. */
async function callerAccess(uid: string): Promise<{ accountId?: string; aiEnabled: boolean }> {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const service = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !service) return { aiEnabled: true };
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data } = await admin.from("profiles").select("account_id, ai_enabled").eq("auth_id", uid).limit(1);
  const row = data?.[0] as { account_id?: string; ai_enabled?: boolean } | undefined;
  return { accountId: row?.account_id, aiEnabled: row?.ai_enabled !== false };
}

/** The workspace's shared key for a provider, decrypted here. Read with the
    service role; the plaintext never leaves the server. */
async function accountKeyFor(accountId: string, provider: Provider): Promise<string | null> {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const service = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !service || !aiKeySecretConfigured()) return null;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data } = await admin.from("account_ai_keys").select(provider).eq("account_id", accountId).maybeSingle();
  const enc = (data as Record<string, string | null> | null)?.[provider];
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null; // e.g. AI_KEY_SECRET was rotated — treat as no key
  }
}

/** Best-effort: add a call's token usage to the signed-in user's running total.
    Never throws — usage tracking must not break an AI response. */
async function recordUsage(uid: string | undefined, input: number, output: number) {
  if (!uid || (input <= 0 && output <= 0)) return;
  try {
    const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!url || !service) return;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await admin.from("profiles").select("id").eq("auth_id", uid).limit(1);
    const profileId = data?.[0]?.id as string | undefined;
    if (!profileId) return;
    await admin.rpc("increment_ai_usage", { p_profile_id: profileId, p_input: input, p_output: output });
  } catch {
    /* swallow — best-effort accounting */
  }
}

type Body = {
  provider?: string;
  model?: string;
  apiKey?: string;
  system?: string;
  messages?: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const provider: Provider = isProvider(body.provider) ? body.provider : "anthropic";
  const providerLabel = PROVIDER_LABEL[provider];

  const { uid, error: authError } = await authedUid(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  // Per-user AI access (admin allowlist) + the shared workspace key (cloud mode).
  let accountId: string | undefined;
  if (uid) {
    const access = await callerAccess(uid);
    if (!access.aiEnabled) {
      return NextResponse.json(
        { error: "AI is turned off for your account. Ask an admin to enable it for you." },
        { status: 403 },
      );
    }
    accountId = access.accountId;
  }

  // Key precedence: request body (local mode) → the workspace's shared key → server env.
  let apiKey = (body.apiKey && body.apiKey.trim()) || "";
  if (!apiKey && accountId) apiKey = (await accountKeyFor(accountId, provider)) ?? "";
  if (!apiKey) apiKey = envKey(provider) ?? "";
  if (!apiKey) {
    return NextResponse.json(
      {
        error: `${providerLabel} isn't configured — an admin can add the workspace key in Settings → AI configuration (or set ${ENV_VAR[provider]} in .env.local).`,
      },
      { status: 501 },
    );
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }
  const maxTokens = Math.min(Math.max(body.maxTokens ?? 1024, 64), 4096);
  const temperature = body.temperature ?? 0.4;
  const stream = Boolean(body.stream);

  let upstream: Response;
  try {
    if (provider !== "anthropic") {
      const cfg = OPENAI_COMPAT[provider];
      const model = cfg.models.has(body.model ?? "") ? body.model : cfg.default;
      upstream = await fetch(cfg.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          stream,
          ...(stream ? { stream_options: { include_usage: true } } : {}),
          messages: body.system ? [{ role: "system", content: body.system }, ...messages] : messages,
        }),
      });
    } else {
      const model = ANTHROPIC_MODELS[body.model ?? ""] ?? "claude-opus-4-8";
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          stream,
          ...(body.system ? { system: body.system } : {}),
          messages,
        }),
      });
    }
  } catch {
    return NextResponse.json({ error: `Couldn't reach ${providerLabel}.` }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    let message = `${providerLabel} request failed (HTTP ${upstream.status}).`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      /* keep the generic message */
    }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  // ---- Non-streaming ----
  if (!stream) {
    const data = await upstream.json();
    const text: string =
      provider !== "anthropic"
        ? (data?.choices?.[0]?.message?.content ?? "")
        : (data?.content ?? [])
            .filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text)
            .join("");
    const u = data?.usage ?? {};
    void recordUsage(
      uid,
      provider !== "anthropic" ? (u.prompt_tokens ?? 0) : (u.input_tokens ?? 0),
      provider !== "anthropic" ? (u.completion_tokens ?? 0) : (u.output_tokens ?? 0),
    );
    return NextResponse.json({ text });
  }

  // ---- Streaming: parse the provider's SSE, re-emit raw text deltas ----
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();

  const extract = (evt: Record<string, unknown>): string => {
    if (provider !== "anthropic") {
      const choices = evt.choices as { delta?: { content?: string } }[] | undefined;
      return choices?.[0]?.delta?.content ?? "";
    }
    const e = evt as { type?: string; delta?: { type?: string; text?: string } };
    return e.type === "content_block_delta" && e.delta?.type === "text_delta" ? (e.delta.text ?? "") : "";
  };

  // Token usage arrives in-stream: Anthropic on message_start/message_delta,
  // OpenAI on a trailing chunk (needs stream_options.include_usage, set above).
  let inTok = 0;
  let outTok = 0;
  const captureUsage = (evt: Record<string, unknown>) => {
    if (provider !== "anthropic") {
      const u = evt.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      if (u) {
        inTok = u.prompt_tokens ?? inTok;
        outTok = u.completion_tokens ?? outTok;
      }
      return;
    }
    const e = evt as { type?: string; message?: { usage?: { input_tokens?: number } }; usage?: { output_tokens?: number } };
    if (e.type === "message_start") inTok = e.message?.usage?.input_tokens ?? inTok;
    else if (e.type === "message_delta") outTok = e.usage?.output_tokens ?? outTok;
  };

  const out = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const json = trimmed.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const evt = JSON.parse(json);
              const delta = extract(evt);
              if (delta) controller.enqueue(encoder.encode(delta));
              captureUsage(evt);
            } catch {
              /* ignore keep-alives / non-JSON lines */
            }
          }
        }
      } finally {
        void recordUsage(uid, inTok, outTok);
        controller.close();
      }
    },
  });

  return new Response(out, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
