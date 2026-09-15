"use client";

import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";

/** Auth header for the AI route (cloud mode requires a signed-in user). */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Supported AI providers, their selectable models, and key hints (used by Settings). */
export const AI_PROVIDERS = {
  anthropic: {
    label: "Claude (Anthropic)",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8 (recommended)" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  openai: {
    label: "ChatGPT (OpenAI)",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", label: "GPT-4o (recommended)" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  xai: {
    label: "Grok (xAI)",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai",
    models: [
      { id: "grok-4", label: "Grok 4 (recommended)" },
      { id: "grok-3", label: "Grok 3" },
      { id: "grok-3-mini", label: "Grok 3 mini" },
    ],
  },
  google: {
    label: "Gemini (Google)",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (recommended)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
} as const;

export type AiProvider = keyof typeof AI_PROVIDERS;

/** The provider chosen in Settings → AI configuration. */
export function currentProvider(): AiProvider {
  const p = useApp.getState().prefs["ai.provider"];
  return typeof p === "string" && p in AI_PROVIDERS ? (p as AiProvider) : "anthropic";
}

/** The model chosen for the active provider. */
function currentModel(): string {
  const provider = currentProvider();
  const prefs = useApp.getState().prefs;
  const m = prefs[`ai.model.${provider}`];
  if (typeof m === "string" && m) return m;
  // Legacy single-model pref applied to Anthropic.
  const legacy = prefs["ai.model"];
  if (provider === "anthropic" && typeof legacy === "string" && legacy) return legacy;
  return AI_PROVIDERS[provider].models[0].id;
}

/** The user-entered API key for a provider (stored only in this browser). */
export function currentKey(provider: AiProvider = currentProvider()): string {
  const k = useApp.getState().prefs[`ai.key.${provider}`];
  return typeof k === "string" ? k.trim() : "";
}

/** Is a given AI feature toggle enabled in Settings? */
export function aiEnabled(key: string): boolean {
  return useApp.getState().prefs[key] !== false;
}

/** Strip obvious PII (emails, phone numbers) when the redact toggle is on. */
export function redactIfEnabled(text: string): string {
  if (useApp.getState().prefs["ai.redact"] === false) return text;
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{2,4}/g, (m) =>
      m.replace(/\d/g, "").length >= 3 && m.replace(/\D/g, "").length >= 7 ? "[phone]" : m,
    );
}

export type AiMessage = { role: "user" | "assistant"; content: string };

/** A provider→false record covering every known provider. */
const emptyStatus = (): Record<AiProvider, boolean> =>
  Object.fromEntries((Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => [p, false])) as Record<
    AiProvider,
    boolean
  >;

/** Merge a partial server response into a full provider→boolean record. */
const fillStatus = (data: Partial<Record<AiProvider, boolean>>): Record<AiProvider, boolean> => {
  const out = emptyStatus();
  for (const p of Object.keys(out) as AiProvider[]) out[p] = Boolean(data[p]);
  return out;
};

/** Which providers have a server-side key in the environment. */
export async function aiEnvStatus(): Promise<Record<AiProvider, boolean>> {
  try {
    const res = await fetch("/api/ai", { method: "GET" });
    if (!res.ok) return emptyStatus();
    return fillStatus((await res.json()) as Partial<Record<AiProvider, boolean>>);
  } catch {
    return emptyStatus();
  }
}

/** Which providers have a workspace key saved on the server (cloud mode). */
export async function aiKeyStatus(): Promise<Record<AiProvider, boolean>> {
  try {
    const res = await fetch("/api/ai/key", { method: "GET", headers: await authHeaders() });
    if (!res.ok) return emptyStatus();
    return fillStatus((await res.json()) as Partial<Record<AiProvider, boolean>>);
  } catch {
    return emptyStatus();
  }
}

/** The signed-in user's running AI token usage (cloud mode). */
export async function aiUsage(): Promise<{ inputTokens: number; outputTokens: number; requests: number }> {
  const empty = { inputTokens: 0, outputTokens: 0, requests: 0 };
  try {
    const res = await fetch("/api/ai/usage", { method: "GET", headers: await authHeaders() });
    if (!res.ok) return empty;
    const d = (await res.json()) as Partial<typeof empty>;
    return {
      inputTokens: Number(d.inputTokens ?? 0),
      outputTokens: Number(d.outputTokens ?? 0),
      requests: Number(d.requests ?? 0),
    };
  } catch {
    return empty;
  }
}

/** Save (or clear, when key is empty) the signed-in user's key for a provider. */
export async function saveAiKey(provider: AiProvider, key: string): Promise<void> {
  const res = await fetch("/api/ai/key", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ provider, key }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AiError(payload?.error ?? `Couldn't save the key (HTTP ${res.status}).`, res.status);
  }
}

/** Whether the active provider is usable — a key (local, per-user, or server) is available. */
export async function checkAiConfigured(): Promise<boolean> {
  // Demo sandbox: the AI proxy requires a signed-in team account, so AI
  // surfaces present as unconfigured rather than failing with auth errors.
  if (useApp.getState().demo) return false;
  const provider = currentProvider();
  if (useApp.getState().backend === "local") {
    if (currentKey(provider)) return true;
  } else if ((await aiKeyStatus())[provider]) {
    return true;
  }
  return (await aiEnvStatus())[provider];
}

/** Demo sessions aren't signed in, so the AI proxy would reject them — fail
    early with a friendly message instead of a generic auth error. */
function assertNotDemo() {
  if (useApp.getState().demo) {
    throw new AiError("AI features are switched off in the demo — sign in with a team account to use them.", 501);
  }
}

/** Common request fields. In local mode the key rides along in the body; in
    cloud mode the server uses the user's stored key, so it's never sent. */
function providerBody() {
  const provider = currentProvider();
  const base = { provider, model: currentModel() };
  if (useApp.getState().backend === "local") {
    const apiKey = currentKey(provider);
    if (apiKey) return { ...base, apiKey };
  }
  return base;
}

export class AiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** One-shot completion. Returns the full text. */
export async function askAI(opts: {
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  assertNotDemo();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...opts, ...providerBody(), stream: false }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AiError(payload?.error ?? `AI request failed (HTTP ${res.status}).`, res.status);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

/**
 * Ask for a JSON result matching a described shape. Retries once on parse
 * failure by asking the model to return only JSON.
 */
export async function askAIJson<T>(opts: {
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
}): Promise<T> {
  const system =
    (opts.system ? opts.system + "\n\n" : "") +
    "Respond with ONLY valid JSON — no prose, no markdown fences.";
  const raw = await askAI({ ...opts, system, temperature: 0.2 });
  return parseJson<T>(raw);
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Salvage the first {...} or [...] block.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new AiError("The AI returned an unexpected format. Please try again.", 502);
  }
}

/** Streaming completion. Calls onChunk with each text delta; returns the full text. */
export async function streamAI(
  opts: { system?: string; messages: AiMessage[]; maxTokens?: number; temperature?: number },
  onChunk: (delta: string) => void,
): Promise<string> {
  assertNotDemo();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...opts, ...providerBody(), stream: true }),
  });
  if (!res.ok || !res.body) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AiError(payload?.error ?? `AI request failed (HTTP ${res.status}).`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onChunk(chunk);
  }
  return full;
}
