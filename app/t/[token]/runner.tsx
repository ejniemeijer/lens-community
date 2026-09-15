"use client";

import * as React from "react";
import { Telescope, ExternalLink, Check, X, ZoomIn, Sun, Moon, MousePointerClick } from "lucide-react";
import type { TestAnswerValue, TestBlock, TestBlockResult, TestOutcome, TestQuestion } from "@/lib/types";
import { FIGMA_FRAME_ASPECT, figmaEmbedUrl } from "@/lib/tests-figma";
import { ZoomLightbox } from "@/components/ui/zoom-lightbox";

/**
 * The participant runner: walks the test's blocks on the public /t/<token>
 * page. Standalone by design — no store, no auth, no app chrome; everything
 * goes through the three /api/t/[token] routes. Results are flushed per
 * block (and on tab close via keepalive) so drop-offs still leave data.
 */

export type RunnerDefinition = { name: string; blocks: TestBlock[] };
type Phase = "loading" | "invalid" | "closed" | "running" | "done";

/** SVGs (often viewBox-only) collapse under w-auto and scale crisply → fill
    width; rasters render at natural size so small images aren't upscaled. */
const isSvgSrc = (s: string) => /\.svg(\?|#|$)/i.test(s) || /^data:image\/svg\+xml/i.test(s);

/** Append the ?lens= context to the app-task URL, whatever its shape. */
function withLensParam(url: string, value: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("lens", value);
    return u.toString();
  } catch {
    return url;
  }
}

/** Participant-controlled theme, independent of the Lens app. Defaults to the
    OS preference and persists under its own key, so a participant's toggle
    never touches the researcher's app theme (and vice versa). Applied as a
    class on the runner's own wrapper — not <html> — so the preview page can
    flip the runner without flipping the builder chrome around it. */
function useRunnerTheme() {
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("lens-test-theme");
    } catch {}
    setDark(stored ? stored === "dark" : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false));
  }, []);
  const toggle = () =>
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem("lens-test-theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  return { dark, toggle };
}

/** Lets a block's own chrome host the theme toggle instead of the floating one
    — the prototype stage puts it in its side panel so it never sits on top of
    the prototype. Null in the embedded glance panel, which has no toggle. */
const RunnerThemeContext = React.createContext<{ dark: boolean | null; toggle: () => void } | null>(null);

function ThemeToggle({
  dark,
  toggle,
  className = "",
}: {
  dark: boolean | null;
  toggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className={`flex items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-foreground ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function LensCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://lensresearch.app"
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center gap-1.5 text-xs text-subtle transition-colors hover:text-foreground ${className}`}
    >
      <Telescope className="h-3.5 w-3.5" /> Powered by Lens
    </a>
  );
}

/**
 * `stage` swaps the centered reading column for an edge-to-edge working
 * surface: the prototype takes the whole viewport and the block's own chrome
 * (credit, padding, max-width) moves into its side panel. Used only while a
 * participant is inside an embedded prototype.
 */
function Frame({ children, embed, stage }: { children: React.ReactNode; embed?: boolean; stage?: boolean }) {
  const { dark, toggle } = useRunnerTheme();
  // Embedded glance panel inherits the surrounding app's theme (no own class,
  // no toggle) so it matches light/dark just like the rest of the builder.
  // The standalone runner and the real preview keep their participant toggle.
  const themeClass = embed ? "" : dark === null ? "" : dark ? "dark" : "light";
  const height = embed ? "h-full min-h-[480px]" : stage ? "min-h-screen lg:h-[100dvh]" : "min-h-screen";
  return (
    <RunnerThemeContext.Provider value={embed ? null : { dark, toggle }}>
      <div
        className={`relative flex flex-col bg-canvas ${height} ${themeClass}`}
        style={embed || dark === null ? undefined : { colorScheme: dark ? "dark" : "light" }}
      >
        {stage ? (
          // The stage has no footer of its own — its side panel hosts the same
          // credit + toggle pair.
          <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
        ) : (
          <>
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">{children}</main>
            <footer className="flex items-center justify-center gap-3 pb-6">
              <LensCredit />
              {!embed && <ThemeToggle dark={dark} toggle={toggle} className="h-7 w-7" />}
            </footer>
          </>
        )}
      </div>
    </RunnerThemeContext.Provider>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Frame>
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-md sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">{body}</p>
      </div>
    </Frame>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-fg shadow-sm transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

/* ---------------- questions ---------------- */

function ScaleButtons({
  scale,
  value,
  onPick,
  small,
}: {
  scale: number;
  value?: number;
  onPick: (n: number) => void;
  small?: boolean;
}) {
  const size = small ? "h-9 w-9 text-sm" : "h-12 w-12 text-base";
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onPick(n)}
          className={`${size} rounded-xl border font-semibold transition-colors ${
            value === n
              ? "border-primary bg-primary text-primary-fg shadow-sm"
              : "border-border bg-surface text-foreground hover:border-primary/50 hover:bg-primary-soft/30"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Whether a question has a usable answer (matrix = every statement rated). */
function answerPresent(q: TestQuestion, v: TestAnswerValue | undefined): boolean {
  if (v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (q.type === "matrix" && typeof v === "object") {
    const statements = (q.statements ?? []).map((s) => s.trim()).filter(Boolean);
    return statements.every((s) => typeof (v as Record<string, number>)[s] === "number");
  }
  return true;
}

/** A question the participant can actually answer (a choice without options
    or a matrix without statements renders no control — never gate on it). */
function answerable(q: TestQuestion): boolean {
  if (q.type === "choice") return (q.options ?? []).some((o) => o.trim());
  if (q.type === "matrix") return (q.statements ?? []).some((s) => s.trim());
  return true;
}

/** Count of required questions still unanswered — gates Continue. */
function missingRequired(questions: TestQuestion[], answers: Record<string, TestAnswerValue>): number {
  return questions.filter((q) => q.required && answerable(q) && !answerPresent(q, answers[q.id])).length;
}

/** Hint under a disabled Continue explaining what's left. */
function RequiredHint({ missing }: { missing: number }) {
  if (missing <= 0) return null;
  return (
    <p className="mt-2 text-center text-xs text-subtle">
      Answer the {missing === 1 ? "required question" : `${missing} required questions`} to continue
    </p>
  );
}

function QuestionList({
  questions,
  answers,
  onAnswer,
}: {
  questions: TestQuestion[];
  answers: Record<string, TestAnswerValue>;
  onAnswer: (id: string, value: TestAnswerValue) => void;
}) {
  const optionRow = (selected: boolean) =>
    `flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-colors ${
      selected ? "border-primary bg-primary-soft/40 text-foreground shadow-sm" : "border-border bg-surface text-foreground hover:border-primary/50 hover:bg-primary-soft/20"
    }`;
  // When every question is required, one calm note beats a pill on each.
  const allRequired = questions.length > 1 && questions.every((q) => q.required);
  return (
    <div className="flex flex-col">
      {allRequired && <p className="text-xs text-subtle">All questions are required.</p>}
      {questions.map((q) => {
        const v = answers[q.id];
        return (
          <div key={q.id} className="border-b border-border py-6 first:pt-0 last:border-0 last:pb-0">
            <p className="text-[17px] font-semibold leading-snug text-foreground">
              {q.prompt}
              {q.required && !allRequired && (
                <span className="ml-2 inline-block translate-y-[-1px] rounded-full border border-border bg-surface-2 px-2 py-0.5 align-middle text-2xs font-medium text-subtle">
                  Required
                </span>
              )}
            </p>
            {q.type === "rating" && (
              <div className="mt-3">
                <ScaleButtons scale={q.scale ?? 5} value={typeof v === "number" ? v : undefined} onPick={(n) => onAnswer(q.id, n)} />
              </div>
            )}
            {q.type === "open" && (
              <textarea
                rows={3}
                value={typeof v === "string" ? v : ""}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                placeholder="Type your answer…"
                className="mt-3 w-full rounded-xl border border-border bg-surface p-3.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary"
              />
            )}
            {q.type === "choice" && (q.options ?? []).every((o) => !o.trim()) && (
              <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-sm text-subtle">
                No answer options configured yet.
              </p>
            )}
            {q.type === "choice" && (q.options ?? []).some((o) => o.trim()) && (
              <div className="mt-3 flex flex-col gap-2">
                {(q.options ?? [])
                  .map((o) => o.trim())
                  .filter(Boolean)
                  .map((option) => {
                    const selectedList = Array.isArray(v) ? v : [];
                    const selected = q.multiple ? selectedList.includes(option) : v === option;
                    return (
                      <button
                        key={option}
                        className={optionRow(selected)}
                        onClick={() => {
                          if (q.multiple) {
                            onAnswer(
                              q.id,
                              selected ? selectedList.filter((x) => x !== option) : [...selectedList, option],
                            );
                          } else {
                            onAnswer(q.id, option);
                          }
                        }}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                            q.multiple ? "rounded-md" : "rounded-full"
                          } ${selected ? "border-primary bg-primary" : "border-border-strong bg-surface"}`}
                        >
                          {selected && <Check className="h-3.5 w-3.5 text-primary-fg" />}
                        </span>
                        {option}
                      </button>
                    );
                  })}
              </div>
            )}
            {q.type === "yes-no" && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {(["yes", "no"] as const).map((option) => (
                  <button key={option} className={optionRow(v === option)} onClick={() => onAnswer(q.id, option)}>
                    <span className="w-full text-center font-medium capitalize">{option}</span>
                  </button>
                ))}
              </div>
            )}
            {q.type === "input" && (
              <input
                type={q.inputFormat ?? "text"}
                value={typeof v === "string" ? v : ""}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                placeholder={
                  q.inputFormat === "email" ? "name@example.com" : q.inputFormat === "number" ? "0" : "Type your answer…"
                }
                className="mt-3 w-full rounded-xl border border-border bg-surface p-3.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary"
              />
            )}
            {q.type === "matrix" && (
              <div className="mt-3 flex flex-col gap-2.5">
                {(q.statements ?? [])
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((statement) => {
                    const m = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
                    return (
                      <div key={statement} className="rounded-xl border border-border bg-surface p-3.5">
                        <p className="mb-2 text-[15px] text-foreground">{statement}</p>
                        <ScaleButtons
                          small
                          scale={q.scale ?? 5}
                          value={m[statement]}
                          onPick={(n) => onAnswer(q.id, { ...m, [statement]: n })}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "How did it go?" — the shared tail of every task block (app task, Figma
    prototype): outcome choice, an optional why in their own words, follow-ups,
    then Continue. The parent owns the state so it can build the result. */
function OutcomeStep({
  outcome,
  onOutcome,
  comment,
  onComment,
  questions,
  answers,
  onAnswer,
  onContinue,
}: {
  outcome: TestOutcome | null;
  onOutcome: (o: TestOutcome) => void;
  comment: string;
  onComment: (v: string) => void;
  questions: TestQuestion[];
  answers: Record<string, TestAnswerValue>;
  onAnswer: (id: string, value: TestAnswerValue) => void;
  onContinue: () => void;
}) {
  const missing = missingRequired(questions, answers);
  return (
    <>
      <p className="mt-6 text-[17px] font-semibold text-foreground">How did it go?</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => onOutcome("success-reported")}
          className={`flex flex-col items-center gap-2.5 rounded-xl border-2 px-4 py-5 transition-all ${
            outcome === "success-reported"
              ? "border-success bg-success-soft/40 shadow-sm"
              : "border-border bg-surface hover:border-success/50"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-medium text-foreground">I completed the task</span>
        </button>
        <button
          onClick={() => onOutcome("gave-up")}
          className={`flex flex-col items-center gap-2.5 rounded-xl border-2 px-4 py-5 transition-all ${
            outcome === "gave-up" ? "border-danger bg-danger-soft/40 shadow-sm" : "border-border bg-surface hover:border-danger/50"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <X className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-medium text-foreground">I couldn&apos;t do it</span>
        </button>
      </div>
      {outcome && (
        <div className="mt-4">
          <label className="text-sm font-medium text-foreground" htmlFor="outcome-comment">
            {outcome === "gave-up" ? "What stopped you?" : "What made it work?"}{" "}
            <span className="font-normal text-subtle">(optional)</span>
          </label>
          <textarea
            id="outcome-comment"
            rows={2}
            value={comment}
            onChange={(e) => onComment(e.target.value)}
            placeholder="In your own words…"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface p-3.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>
      )}
      {outcome && questions.length > 0 && (
        <div className="mt-4">
          <QuestionList questions={questions} answers={answers} onAnswer={onAnswer} />
        </div>
      )}
      <PrimaryButton className="mt-7 w-full" disabled={!outcome || missing > 0} onClick={onContinue}>
        Continue
      </PrimaryButton>
      {!!outcome && <RequiredHint missing={missing} />}
    </>
  );
}

/**
 * The working surface for an embedded prototype: the prototype gets the whole
 * viewport, the task and its questions sit in a side panel (on top on narrow
 * screens). The stage is capped to the block's chosen aspect × the viewport
 * height, so a phone prototype gets a phone-shaped column instead of a
 * letterbox stretched across a wide monitor — and a desktop prototype gets
 * everything there is.
 */
function ProtoStage({
  block,
  embedSrc,
  preview,
  progress,
  stepLabel,
  children,
}: {
  block: Extract<TestBlock, { type: "figma-proto" }>;
  embedSrc: string | null;
  preview: boolean;
  progress: number;
  stepLabel: React.ReactNode;
  children: React.ReactNode;
}) {
  const aspect = FIGMA_FRAME_ASPECT[block.frame ?? "desktop"];
  const theme = React.useContext(RunnerThemeContext);
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Panel first in the DOM so a narrow screen reads task-then-prototype;
          visually it moves to the right on wide screens. */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-surface lg:order-2 lg:w-[380px] lg:overflow-y-auto lg:border-b-0 lg:border-l">
        <div className="flex flex-1 flex-col px-5 py-5 sm:px-6">
          {preview && (
            <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-center text-xs font-medium text-warning">
              Preview mode — nothing is recorded
            </div>
          )}
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
          <p className="text-[17px] font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
          {block.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{block.description}</p>}
          {children}
          <div className="mt-6 flex flex-col gap-1.5 pt-2">
            {/* Figma renders its own permission wall inside the iframe when a
                prototype isn't shared publicly — we can't detect that
                cross-origin, so always offer the escape hatch. */}
            {embedSrc && (
              <p className="text-center text-xs text-subtle">
                Not loading?{" "}
                <a href={embedSrc} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                  Open it in a new tab
                </a>
              </p>
            )}
            <p className="text-center text-[13px] text-subtle">{stepLabel}</p>
            <div className="flex items-center justify-center gap-3">
              <LensCredit />
              {theme && <ThemeToggle dark={theme.dark} toggle={theme.toggle} className="h-7 w-7" />}
            </div>
          </div>
        </div>
      </aside>
      <div
        className="flex min-h-0 flex-1 items-center justify-center bg-surface-2 p-2 sm:p-3 lg:order-1"
        style={{ "--pa": aspect } as React.CSSProperties}
      >
        {embedSrc ? (
          <div className="mx-auto aspect-[var(--pa)] w-full overflow-hidden rounded-xl border border-border bg-canvas lg:aspect-auto lg:h-full lg:max-w-[calc(100dvh*var(--pa))]">
            <iframe src={embedSrc} title="Prototype" allowFullScreen className="block h-full w-full" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
            <p className="text-sm text-muted">{block.url ? "The prototype couldn't be loaded." : "No prototype added yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- runner ---------------- */

export function TestRunner({
  token,
  preview = false,
  embed = false,
  initialDefinition,
  hasEmbeddedProto: hasEmbeddedProtoProp,
}: {
  token: string;
  /** Preview mode: render the exact participant flow, but never create a
      session, never PATCH results, never pass beacon context to app tasks. */
  preview?: boolean;
  /** Embedded illustration (builder side panel): auto height instead of
      full-viewport, no theme toggle. Pair with preview + initialDefinition. */
  embed?: boolean;
  /** Skips the definition fetch — used by the researcher preview, which
      reads the (possibly unpublished) test straight from the store. */
  initialDefinition?: RunnerDefinition;
  /** Override for the consent gate's Figma disclosure. The builder's glance
      panel renders a single block in isolation, so the gate can't see the rest
      of the test — without this it would hide a sentence the real gate shows. */
  hasEmbeddedProto?: boolean;
}) {
  const [phase, setPhase] = React.useState<Phase>(initialDefinition ? "running" : "loading");
  const [def, setDef] = React.useState<RunnerDefinition | null>(initialDefinition ?? null);
  const [index, setIndex] = React.useState(0);
  const [consented, setConsented] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, TestAnswerValue>>({});
  const [click, setClick] = React.useState<{ x: number; y: number } | null>(null);
  const [outcome, setOutcome] = React.useState<TestOutcome | null>(null);
  const [outcomeComment, setOutcomeComment] = React.useState("");
  const [opened, setOpened] = React.useState(false);
  const [choice, setChoice] = React.useState<string | null>(null);
  // five-second: idle → showing (countdown) → asking
  const [glimpse, setGlimpse] = React.useState<"idle" | "showing" | "asking">("idle");
  const [countdown, setCountdown] = React.useState(0);
  const [imgFailed, setImgFailed] = React.useState(false);
  /** Fullscreen image overlay — holds the URL being inspected (design
      feedback image or a preference option). */
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  const session = React.useRef<{ id: string; token: string } | null>(null);
  const blockStart = React.useRef(Date.now());
  const clickAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (initialDefinition) return; // preview: definition supplied locally
    fetch(`/api/t/${token}`)
      .then(async (r) => {
        if (r.status === 404) return setPhase("invalid");
        if (!r.ok) return setPhase("closed");
        setDef(await r.json());
        setPhase("running");
      })
      .catch(() => setPhase("invalid"));
  }, [token, initialDefinition]);

  const blocks = def?.blocks ?? [];
  const block = blocks[index];

  const save = React.useCallback(
    (blockId: string, result: TestBlockResult, complete = false) => {
      if (preview || !session.current) return Promise.resolve(); // preview records nothing
      return fetch(`/api/t/${token}/session`, {
        method: "PATCH",
        keepalive: true, // survives navigation on the final flush
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.current.id,
          sessionToken: session.current.token,
          blockId,
          result,
          complete,
        }),
      }).catch(() => {});
    },
    [token, preview],
  );

  // Drop-off telemetry: flush the in-progress block when the tab closes.
  React.useEffect(() => {
    const onHide = () => {
      const b = blocks[index];
      if (b && session.current && phase === "running") {
        void save(b.id, { durationMs: Date.now() - blockStart.current, answers });
      }
    };
    addEventListener("pagehide", onHide);
    return () => removeEventListener("pagehide", onHide);
  }, [blocks, index, answers, phase, save]);

  if (phase === "loading") {
    return (
      <Frame embed={embed}>
        <div className="flex justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </Frame>
    );
  }
  if (phase === "invalid") return <Notice title="This link isn't valid" body="Check that you copied the full link, or ask the person who sent it for a new one." />;
  if (phase === "closed") return <Notice title="This test is closed" body="Thanks for your interest — this study is no longer accepting responses." />;
  if (phase === "done" || !block) {
    return (
      <Frame embed={embed}>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-md sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{preview ? "End of preview" : "All done — thank you!"}</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
            {preview ? "Nothing was recorded — this is exactly what participants will see." : "Your feedback has been recorded. You can close this tab."}
          </p>
        </div>
      </Frame>
    );
  }

  const advance = async (result: TestBlockResult) => {
    const isLast = index === blocks.length - 1;
    void save(block.id, { durationMs: Date.now() - blockStart.current, ...result }, isLast);
    setAnswers({});
    setClick(null);
    setOutcome(null);
    setOutcomeComment("");
    setOpened(false);
    setChoice(null);
    setGlimpse("idle");
    setImgFailed(false);
    setLightbox(null);
    clickAt.current = null;
    blockStart.current = Date.now();
    if (isLast) setPhase("done");
    else setIndex(index + 1);
  };

  /** Result payload shared by the task blocks (app task, Figma prototype). */
  const taskResult = (): TestBlockResult => ({
    outcome: outcome!,
    answers,
    ...(outcomeComment.trim() ? { outcomeComment: outcomeComment.trim().slice(0, 1000) } : {}),
  });

  const startGlimpse = (seconds: number) => {
    setGlimpse("showing");
    setCountdown(seconds);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setGlimpse("asking");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const startSession = async () => {
    if (preview) {
      // No session row — just walk into the flow.
      blockStart.current = Date.now();
      setIndex(index + 1);
      return;
    }
    const res = await fetch(`/api/t/${token}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device: {
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          pointer: window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "mouse",
        },
      }),
    });
    if (!res.ok) return setPhase("closed");
    const j = (await res.json()) as { sessionId: string; sessionToken: string };
    session.current = { id: j.sessionId, token: j.sessionToken };
    blockStart.current = Date.now();
    setIndex(index + 1);
  };

  const progress = blocks.length > 1 ? index / blocks.length : 0;
  // Never iframe a raw researcher-typed string: the normalizer only ever
  // returns an embed.figma.com URL, and null for anything else.
  const embedSrc = block.type === "figma-proto" ? figmaEmbedUrl(block.url) : null;
  // Disclosed at the gate, not per block: consent has to cover the whole run.
  const hasEmbeddedProto = hasEmbeddedProtoProp ?? blocks.some((b) => b.type === "figma-proto");
  const stepLabel = (
    <>
      {def?.name} · step {index + 1} of {blocks.length}
    </>
  );
  // Once they're inside the prototype it owns the screen. The glance panel in
  // the builder stays in the plain column — it's a small illustration.
  if (block.type === "figma-proto" && opened && !embed) {
    const questions = block.followUpQuestions;
    const onAnswer = (id: string, v: TestAnswerValue) => setAnswers((a) => ({ ...a, [id]: v }));
    return (
      <Frame embed={embed} stage>
        <ProtoStage block={block} embedSrc={embedSrc} preview={preview} progress={progress} stepLabel={stepLabel}>
          {block.taskType === "explore" ? (
            <>
              {questions.length > 0 && (
                <div className="mt-5">
                  <QuestionList questions={questions} answers={answers} onAnswer={onAnswer} />
                </div>
              )}
              <PrimaryButton className="mt-6 w-full" disabled={missingRequired(questions, answers) > 0} onClick={() => advance({ answers })}>
                Continue
              </PrimaryButton>
              <RequiredHint missing={missingRequired(questions, answers)} />
            </>
          ) : (
            <OutcomeStep
              outcome={outcome}
              onOutcome={setOutcome}
              comment={outcomeComment}
              onComment={setOutcomeComment}
              questions={questions}
              answers={answers}
              onAnswer={onAnswer}
              onContinue={() => advance(taskResult())}
            />
          )}
        </ProtoStage>
      </Frame>
    );
  }

  return (
    <Frame embed={embed}>
      {preview && !embed && (
        <div className="mb-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-center text-xs font-medium text-warning">
          Preview mode — nothing is recorded
        </div>
      )}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-9">
        {block.type === "message" && block.isConsentGate && !session.current ? (
          <>
            {block.title && <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{block.title}</h1>}
            {block.bodyMd && <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-muted">{block.bodyMd}</p>}
            <div className="mt-6 rounded-xl border border-border bg-surface-2 p-4">
              <p className="text-sm leading-relaxed text-muted">{block.consentText}</p>
              {/* Added automatically, so an existing test's consent text stays
                  accurate the moment a prototype block is added to it. */}
              {hasEmbeddedProto && (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  This test shows a Figma prototype inside the page. Figma receives your IP address and may set cookies
                  in your browser when it loads.
                </p>
              )}
              <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 text-[15px] font-medium text-foreground">
                <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-[hsl(var(--primary))]" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                I agree to take part in this test.
              </label>
            </div>
            <PrimaryButton className="mt-6 w-full" disabled={!consented} onClick={startSession}>
              Start
            </PrimaryButton>
          </>
        ) : block.type === "message" ? (
          <>
            {block.title && <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{block.title}</h1>}
            {block.bodyMd && <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-muted">{block.bodyMd}</p>}
            <PrimaryButton className="mt-6 w-full" onClick={() => advance({})}>Continue</PrimaryButton>
          </>
        ) : block.type === "questions" ? (
          <>
            <QuestionList questions={block.questions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
            <PrimaryButton className="mt-8 w-full" disabled={missingRequired(block.questions, answers) > 0} onClick={() => advance({ answers })}>
              Continue
            </PrimaryButton>
            <RequiredHint missing={missingRequired(block.questions, answers)} />
          </>
        ) : block.type === "first-click" ? (
          <>
            <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
            {block.description && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{block.description}</p>}
            <p className="mt-1.5 text-sm text-subtle">Click once on the image where you would click.</p>
            {imgFailed || !block.imageUrl ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-surface-2 p-5 text-center">
                <p className="text-sm text-muted">
                  {block.imageUrl ? "The image couldn't be loaded — you can continue to the next step." : "No image added yet."}
                </p>
              </div>
            ) : (
              <div className="relative mt-3 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.imageUrl}
                  alt="Design under test"
                  className="w-full cursor-crosshair select-none"
                  draggable={false}
                  onError={() => setImgFailed(true)}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setClick({
                      x: +((e.clientX - rect.left) / rect.width).toFixed(4),
                      y: +((e.clientY - rect.top) / rect.height).toFixed(4),
                    });
                    clickAt.current ??= Date.now() - blockStart.current;
                  }}
                />
                {click && (
                  <span
                    className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/80 shadow"
                    style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }}
                  />
                )}
              </div>
            )}
            {click && block.followUpQuestions.length > 0 && (
              <div className="mt-6">
                <QuestionList questions={block.followUpQuestions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
              </div>
            )}
            <PrimaryButton
              className="mt-6 w-full"
              disabled={(!click && !imgFailed) || (!!click && missingRequired(block.followUpQuestions, answers) > 0)}
              onClick={() =>
                advance(imgFailed && !click ? { outcome: "skipped", answers } : { click: click!, timeToClickMs: clickAt.current ?? undefined, answers })
              }
            >
              Continue
            </PrimaryButton>
            {!!click && <RequiredHint missing={missingRequired(block.followUpQuestions, answers)} />}
          </>
        ) : block.type === "preference" ? (
          <>
            <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
            {block.description && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{block.description}</p>}
            <p className="mt-1.5 text-sm text-subtle">Tap the design you prefer — use the magnifier to see it full size.</p>
            <div className={`mt-4 grid gap-3.5 ${block.options.length > 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
              {block.options.map((o, i) => (
                <button
                  key={o.id}
                  onClick={() => setChoice(o.id)}
                  className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
                    choice === o.id ? "border-primary shadow-md" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="relative block">
                    {o.imageUrl ? (
                      <>
                        {/* Fills the card for side-by-side comparison, capped so
                            a tall image doesn't dominate; the magnifier enlarges. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.imageUrl} alt={o.label ?? `Option ${i + 1}`} className="max-h-64 w-full select-none object-contain" draggable={false} />
                        <span
                          role="button"
                          aria-label={`Enlarge ${o.label || `option ${String.fromCharCode(65 + i)}`}`}
                          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-surface"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox(o.imageUrl);
                          }}
                        >
                          <ZoomIn className="h-[18px] w-[18px]" />
                        </span>
                      </>
                    ) : (
                      <span className="flex aspect-video items-center justify-center bg-surface-2 text-xs text-subtle">No image yet</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-foreground">
                    {choice === o.id && <Check className="h-4 w-4 text-primary" />}
                    {o.label || `Option ${String.fromCharCode(65 + i)}`}
                  </span>
                </button>
              ))}
            </div>
            {choice && block.followUpQuestions.length > 0 && (
              <div className="mt-6">
                <QuestionList questions={block.followUpQuestions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
              </div>
            )}
            <PrimaryButton
              className="mt-6 w-full"
              disabled={!choice || missingRequired(block.followUpQuestions, answers) > 0}
              onClick={() => advance({ choice: choice!, answers })}
            >
              Continue
            </PrimaryButton>
            {!!choice && <RequiredHint missing={missingRequired(block.followUpQuestions, answers)} />}
          </>
        ) : block.type === "five-second" ? (
          glimpse === "idle" ? (
            <>
              <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">
                {block.instructions || "You'll see a design for a few seconds — look at it as you normally would."}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                It disappears after {block.seconds ?? 5}{" "}
                seconds, then we&apos;ll ask what you remember.
              </p>
              <PrimaryButton className="mt-6 w-full" onClick={() => startGlimpse(block.seconds ?? 5)}>
                I&apos;m ready — show it
              </PrimaryButton>
            </>
          ) : glimpse === "showing" ? (
            <>
              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border">
                {block.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.imageUrl} alt="Design" className={`max-h-80 max-w-full select-none object-contain ${isSvgSrc(block.imageUrl) ? "w-full" : "w-auto"}`} draggable={false} />
                ) : (
                  <span className="flex aspect-video w-full items-center justify-center bg-surface-2 text-xs text-subtle">No image yet</span>
                )}
              </div>
              <p className="mt-4 text-center font-mono text-2xl font-semibold text-muted">{countdown}</p>
            </>
          ) : (
            <>
              <QuestionList questions={block.questions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
              <PrimaryButton className="mt-8 w-full" disabled={missingRequired(block.questions, answers) > 0} onClick={() => advance({ answers })}>
                Continue
              </PrimaryButton>
              <RequiredHint missing={missingRequired(block.questions, answers)} />
            </>
          )
        ) : block.type === "design-feedback" ? (
          <>
            <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
            {block.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{block.description}</p>}
            {block.imageUrl && !imgFailed && (
              <>
                <button
                  className="mt-4 flex w-full justify-center overflow-hidden rounded-xl border border-border bg-surface-2 p-3 transition-shadow hover:shadow-md"
                  onClick={() => setLightbox(block.imageUrl)}
                  aria-label="Enlarge design"
                >
                  {/* Capped so small images aren't upscaled into a blurry box —
                      the lightbox handles full-size viewing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.imageUrl}
                    alt="Design to review"
                    className={`max-h-64 max-w-full cursor-zoom-in select-none rounded object-contain ${isSvgSrc(block.imageUrl) ? "w-full" : "w-auto"}`}
                    draggable={false}
                    onError={() => setImgFailed(true)}
                  />
                </button>
                <p className="mt-1.5 text-center text-xs text-subtle">Click the image to enlarge</p>
              </>
            )}
            <div className="mt-6">
              <QuestionList questions={block.questions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
            </div>
            <PrimaryButton className="mt-8 w-full" disabled={missingRequired(block.questions, answers) > 0} onClick={() => advance({ answers })}>
              Continue
            </PrimaryButton>
            <RequiredHint missing={missingRequired(block.questions, answers)} />
          </>
        ) : block.type === "figma-proto" ? (
          <>
            <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
            {block.description && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{block.description}</p>}
            {/* Intro only — pressing start hands the whole viewport to
                ProtoStage, so the prototype never loads before they ask for it
                and time on task starts when they do. */}
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary-soft/50 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <MousePointerClick className="h-[18px] w-[18px]" />
              </span>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-foreground">The prototype opens right here</p>
                <p className="mt-0.5 text-muted">
                  {block.taskType === "explore"
                    ? "Take as long as you like and click wherever you're curious — there's nothing to get right."
                    : "Click through it as you normally would — then tell us how it went, also if you get stuck."}
                </p>
              </div>
            </div>
            <PrimaryButton className="mt-6 w-full" onClick={() => setOpened(true)}>
              {block.taskType === "explore" ? "Start exploring" : "Start the prototype"}
            </PrimaryButton>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold leading-snug tracking-tight text-foreground">{block.instructions}</p>
            {block.description && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{block.description}</p>}
            {!opened ? (
              // Stage 1: one primary action — get them into the app. A preview
              // screenshot (when set) and a highlighted new-tab callout make it
              // obvious what's about to happen.
              <>
                {block.previewImageUrl && !imgFailed && (
                  <figure className="mt-5 overflow-hidden rounded-xl border border-border bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.previewImageUrl}
                      alt="Preview of the app you are about to open"
                      className="max-h-60 w-full select-none object-cover object-top"
                      draggable={false}
                      onError={() => setImgFailed(true)}
                    />
                    <figcaption className="border-t border-border px-3 py-2 text-center text-xs text-subtle">
                      This is the app that will open
                    </figcaption>
                  </figure>
                )}
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary-soft/50 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <ExternalLink className="h-[18px] w-[18px]" />
                  </span>
                  <div className="text-sm leading-relaxed">
                    <p className="font-semibold text-foreground">The app opens in a new tab</p>
                    <p className="mt-0.5 text-muted">
                      Do the task there, then come back to this tab and tell us how it went — also if you get stuck.
                    </p>
                  </div>
                </div>
                <a
                  href={preview ? block.url : withLensParam(block.url, `${session.current?.id}.${session.current?.token}.${block.id}`)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpened(true)}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-fg shadow-sm transition-[filter] hover:brightness-110"
                >
                  <ExternalLink className="h-[18px] w-[18px]" /> Open the app
                </a>
              </>
            ) : (
              // Stage 2: the outcome is the decision; reopening is demoted to a link.
              <>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <ExternalLink className="h-4 w-4 shrink-0" /> The app is open in another tab
                  </span>
                  <a
                    href={preview ? block.url : withLensParam(block.url, `${session.current?.id}.${session.current?.token}.${block.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Open again
                  </a>
                </div>
                <OutcomeStep
                  outcome={outcome}
                  onOutcome={setOutcome}
                  comment={outcomeComment}
                  onComment={setOutcomeComment}
                  questions={block.followUpQuestions}
                  answers={answers}
                  onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
                  onContinue={() => advance(taskResult())}
                />
              </>
            )}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[13px] text-subtle">{stepLabel}</p>
      {lightbox && <ZoomLightbox src={lightbox} alt="Enlarged design" onClose={() => setLightbox(null)} />}
    </Frame>
  );
}
