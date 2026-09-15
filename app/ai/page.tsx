"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  GitCompare,
  Layers,
  Contact,
  SearchX,
  Hash,
  Tag as TagIcon,
  Send,
  ArrowRight,
  X,
  RefreshCw,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import {
  aiSuggestions as seededSuggestions,
  insights,
  interviews,
  getInsight,
  getTheme,
  getPersona,
  getCompany,
  getInterview,
  currentUser,
} from "@/lib/db";
import type { AiSuggestion, Confidence } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/domain/badges";
import { Stat } from "@/components/ui/misc";
import { streamAI, askAIJson, aiEnabled, checkAiConfigured, AiError, type AiMessage } from "@/lib/ai";
import { workspaceSnapshot, suggestionsContext } from "@/lib/ai-context";
import { fetchSessionTallies } from "@/lib/test-sessions";
import { relativeToNow, uid } from "@/lib/utils";

const KIND_META: Record<AiSuggestion["kind"], { label: string; icon: LucideIcon }> = {
  duplicate: { label: "Duplicate detection", icon: Copy },
  similar: { label: "Similar interviews", icon: GitCompare },
  theme: { label: "Suggested themes", icon: Layers },
  persona: { label: "Persona balance", icon: Contact },
  opportunity: { label: "Opportunities", icon: Sparkles },
  gap: { label: "Research gaps", icon: SearchX },
  topic: { label: "Frequent topics", icon: Hash },
  tag: { label: "Suggested tags", icon: TagIcon },
};

const QUICK_PROMPTS = [
  "What are the top pain points across all research?",
  "Which theme has the strongest signal?",
  "Where should we research next?",
  "What are our usability tests telling us?",
];

function resolveRef(id: string): { href: string; label: string } | null {
  if (id.startsWith("in-") || id.startsWith("in_")) { const x = getInsight(id); return x ? { href: `/insights/${id}`, label: x.title } : null; }
  if (id.startsWith("th-")) { const x = getTheme(id); return x ? { href: `/themes`, label: x.name } : null; }
  if (id.startsWith("pe-")) { const x = getPersona(id); return x ? { href: `/personas`, label: x.name } : null; }
  if (id.startsWith("co-")) { const x = getCompany(id); return x ? { href: `/participants?company=${id}`, label: x.name } : null; }
  if (id.startsWith("iv-")) { const x = getInterview(id); return x ? { href: `/interviews/${id}`, label: x.title } : null; }
  return null;
}

const SYSTEM_PROMPT = `You are the research assistant inside "Lens", a UX research repository for a team that builds enterprise asset-management / maintenance software.

Answer questions about the team's research using ONLY the repository data provided below. Be concise, specific, and practical — reference insight, interview, theme, persona, or test names when relevant. Use short paragraphs or tight bullet lists. If the data doesn't cover something, say so plainly and suggest what research would close the gap. Never invent findings, numbers, or quotes.

The repository holds two kinds of evidence: qualitative (interviews, insights) and unmoderated tests (task outcomes, ratings, and participants' own words). Where both bear on a question, say what each shows and flag it when they disagree. A test whose response counts are listed as unavailable has unknown participation — never describe it as having no responses.`;

/**
 * Generated suggestions are saved so they survive leaving the page — they cost
 * tokens to produce, and losing them on navigation made Refresh the only way
 * to see them at all.
 *
 * They ride in the personal-prefs bag rather than a new store field: prefs is
 * the one channel that already persists correctly in all three modes (cloud →
 * profiles.preferences, local → localStorage, demo → deliberately ephemeral).
 * Personal, not workspace: dismissals are per-person, so the set they apply to
 * should be too.
 */
const SUGGESTIONS_PREF = "ai.savedSuggestions";

interface SavedSuggestions {
  at: string;
  items: AiSuggestion[];
}

function readSaved(raw: string | boolean | undefined): SavedSuggestions | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedSuggestions;
    return Array.isArray(parsed?.items) ? parsed : null;
  } catch {
    return null; // corrupt or from an older shape — treat as "none saved"
  }
}

export default function AiPage() {
  useDb();
  const role = useApp((s) => s.role);
  const backend = useApp((s) => s.backend);
  const dismissed = useApp((s) => s.dismissedAi);
  const dismissSuggestion = useApp((s) => s.dismissSuggestion);
  const toast = useApp((s) => s.toast);

  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const setPref = useApp((s) => s.setPref);
  const forgetDismissed = useApp((s) => s.forgetDismissed);
  const savedRaw = useApp((s) => s.prefs[SUGGESTIONS_PREF]);
  const prefsLoaded = useApp((s) => s.prefsLoaded);
  const saved = React.useMemo(() => readSaved(savedRaw), [savedRaw]);
  const generated = saved?.items ?? null;
  /** Cloud prefs load after mount, so hold the empty state until they arrive —
      otherwise a saved set flashes as "No suggestions yet" on every visit. */
  const awaitingSaved = backend === "cloud" && !prefsLoaded;
  const [refreshing, setRefreshing] = React.useState(false);
  const threadRef = React.useRef<HTMLDivElement>(null);
  const canSuggest = aiEnabled("ai.suggestions");

  const refreshSuggestions = async () => {
    setRefreshing(true);
    const tallies = await fetchSessionTallies();
    try {
      // Themes/tags/personas/topics are always part of the suggestions engine;
      // duplicates, opportunities, and gaps are gated by their own
      // Settings → Assisted features toggles so each switch controls a real kind.
      const KINDS = [
        "theme",
        "persona",
        "topic",
        "tag",
        ...(aiEnabled("ai.duplicates") ? ["duplicate", "similar"] : []),
        ...(aiEnabled("ai.opportunities") ? ["opportunity"] : []),
        ...(aiEnabled("ai.gaps") ? ["gap"] : []),
      ];
      const result = await askAIJson<{
        suggestions: {
          kind: string;
          title: string;
          detail: string;
          confidence: "low" | "medium" | "high";
          relatedIds?: string[];
        }[];
      }>({
        system:
          `You analyze a UX research repository and surface the most useful patterns. Return JSON: { "suggestions": [ { "kind", "title", "detail", "confidence", "relatedIds" } ] }. ` +
          `"kind" must be one of: ${KINDS.join(", ")} — use only these kinds. Include 4–8 suggestions spread across the available kinds. ` +
          `"relatedIds" should reference the real insight (in_/in-) or interview (iv-) ids from the data where relevant. Keep titles short and details to one sentence. Be specific to the actual data.`,
        messages: [{ role: "user", content: suggestionsContext(tallies) }],
        maxTokens: 1500,
      });
      const items: AiSuggestion[] = (result.suggestions ?? [])
        .filter((s) => KINDS.includes(s.kind) && s.title)
        .map((s) => ({
          id: uid("ai"),
          kind: s.kind as AiSuggestion["kind"],
          title: s.title,
          detail: s.detail ?? "",
          confidence: (["low", "medium", "high"].includes(s.confidence) ? s.confidence : "medium") as Confidence,
          relatedIds: Array.isArray(s.relatedIds) ? s.relatedIds : [],
        }));
      // A refresh is an explicit "show me a fresh look", so dismissals of the
      // set being replaced are cleared — otherwise the new set could arrive
      // partly pre-hidden and Refresh would look broken.
      if (generated?.length) forgetDismissed(generated.map((g) => g.id));
      setPref(SUGGESTIONS_PREF, JSON.stringify({ at: new Date().toISOString(), items } satisfies SavedSuggestions));
      toast(items.length ? `Generated ${items.length} suggestions` : "No new suggestions found", "info");
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't refresh suggestions.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    if (role === "admin") checkAiConfigured().then(setConfigured);
  }, [role]);

  React.useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // The seeded suggestions describe the seeded dataset (present in the demo
  // sandbox and local prototype). A real cloud workspace starts fresh and
  // fills in via Generate, so its own — possibly empty — data drives the page.
  const baseSuggestions = backend === "cloud" ? [] : seededSuggestions;
  const activeSuggestions = generated ?? baseSuggestions;
  const visibleSuggestions = activeSuggestions.filter((s) => !dismissed.includes(s.id));
  const hasContent = insights.length > 0 || interviews.length > 0;
  const grouped = visibleSuggestions.reduce<Record<string, AiSuggestion[]>>((acc, s) => {
    (acc[s.kind] ||= []).push(s);
    return acc;
  }, {});

  const send = async (question: string) => {
    if (!question.trim() || streaming) return;
    const history: AiMessage[] = [...messages, { role: "user", content: question.trim() }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      // Response counts are fetched per question so they're current at answer
      // time; null (local/demo) makes the context say "unavailable".
      const tallies = await fetchSessionTallies();
      await streamAI(
        {
          system: `${SYSTEM_PROMPT}\n\n<repository>\n${workspaceSnapshot(tallies)}\n</repository>`,
          messages: history,
          maxTokens: 1200,
        },
        (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + delta,
            };
            return next;
          });
        },
      );
    } catch (e) {
      const msg = e instanceof AiError ? e.message : "Something went wrong. Please try again.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
        return next;
      });
      if (e instanceof AiError && e.status === 501) setConfigured(false);
    } finally {
      setStreaming(false);
    }
  };

  // Viewers don't get AI; an admin can also switch AI off for a specific user.
  const aiOffForUser = currentUser().aiEnabled === false;
  if (!can(role, "use-ai") || aiOffForUser) {
    return (
      <>
        <PageHeader
          title="AI Assistant"
          icon={<PageIcon icon={Sparkles} />}
        />
        <PageBody>
          <div className="mx-auto max-w-md pt-10 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-subtle">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
              {aiOffForUser ? "AI is turned off for your account" : "Not available for your role"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {aiOffForUser
                ? "An administrator has disabled AI for your account. Ask them to turn it back on if you need it."
                : "The AI Assistant isn't available to viewer accounts. Ask an administrator if you need access."}
            </p>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="AI helps you see patterns faster — it always supports your judgment, never replaces it. Answers are grounded in your repository."
        icon={<span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles className="h-5 w-5" /></span>}
      />
      <PageBody>
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {configured === false && (
            <Card className="flex items-start gap-3 border-warning/30 bg-warning-soft/30 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-[13px] text-muted">
                <p className="font-medium text-foreground">AI isn&apos;t configured yet</p>
                <p className="mt-0.5">
                  Choose a provider and add your API key under{" "}
                  <Link href="/settings" className="text-primary hover:underline">Settings → AI configuration</Link>.
                </p>
              </div>
            </Card>
          )}

          {/* Conversation */}
          <Card className="flex flex-col p-4">
            {messages.length > 0 && (
              <div ref={threadRef} className="mb-3 flex max-h-[46vh] flex-col gap-3 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2.5"}>
                    {m.role === "assistant" && <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-[14px] text-primary-fg"
                          : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2 text-[14px] leading-relaxed text-foreground"
                      }
                    >
                      {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Ask anything about your research…"
                disabled={streaming || configured === false}
                className="h-11 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-subtle focus:outline-none disabled:opacity-60"
              />
              <Button size="sm" variant="primary" onClick={() => send(input)} disabled={streaming || configured === false || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            {messages.length === 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={configured === false}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-border-strong hover:text-foreground disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Opportunities" value={insights.filter((i) => i.type === "opportunity").length} />
            <Stat label="Duplicates flagged" value={grouped.duplicate?.length ?? 0} />
            <Stat label="Research gaps" value={grouped.gap?.length ?? 0} />
            <Stat label="Interviews" value={interviews.length} />
          </div>

          {/* Suggestions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Suggestions</h2>
              <span className="text-xs text-subtle">
                {/* Saying when they were made is the point of saving them: it's
                    what tells you whether a refresh is worth the tokens. */}
                {saved
                  ? `Generated ${relativeToNow(saved.at)}`
                  : visibleSuggestions.length
                    ? "AI-surfaced patterns worth a look"
                    : "Generate patterns from your research"}
              </span>
              {canSuggest && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={refreshSuggestions}
                  disabled={refreshing || configured === false}
                >
                  <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {refreshing ? "Analyzing…" : "Refresh"}
                </Button>
              )}
            </div>
            {visibleSuggestions.map((s) => {
              const meta = KIND_META[s.kind];
              const Icon = meta.icon;
              const refs = (s.relatedIds ?? []).map(resolveRef).filter(Boolean) as { href: string; label: string }[];
              return (
                <Card key={s.id} className="flex gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{meta.label}</span>
                      <ConfidenceBadge value={s.confidence as Confidence} />
                      <button
                        onClick={() => {
                          dismissSuggestion(s.id);
                          toast("Suggestion dismissed", "info");
                        }}
                        className="ml-auto rounded p-1 text-subtle hover:bg-surface-hover hover:text-foreground"
                        aria-label="Dismiss suggestion"
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-[14px] font-medium text-foreground">{s.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{s.detail}</p>
                    {refs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {refs.map((r) => (
                          <Link key={r.href + r.label} href={r.href} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:border-border-strong hover:text-foreground">
                            {r.label} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {visibleSuggestions.length === 0 && !awaitingSaved && (
              <Card className="flex flex-col items-center gap-2 p-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  {generated ? "You're all caught up" : "No suggestions yet"}
                </p>
                <p className="max-w-sm text-[13px] text-muted">
                  {generated
                    ? "Use Refresh to surface new patterns from your latest data."
                    : hasContent
                      ? "Lens can scan your research for duplicates, emerging themes, persona gaps, and opportunities."
                      : "Add participants and interviews, then Lens can surface duplicates, themes, and gaps from your research."}
                </p>
                {canSuggest && hasContent && !generated && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-1"
                    onClick={refreshSuggestions}
                    disabled={refreshing || configured === false}
                  >
                    <Sparkles className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                    {refreshing ? "Analyzing…" : "Generate suggestions"}
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
