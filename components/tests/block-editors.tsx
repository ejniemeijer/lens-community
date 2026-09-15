"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Copy, Check, Compass, Eye, Radio, ScanSearch, Trophy, Upload, X, Image as ImageIcon } from "lucide-react";
import type {
  AppTaskBlock,
  DesignFeedbackBlock,
  FigmaProtoBlock,
  FirstClickBlock,
  FiveSecondBlock,
  MessageBlock,
  PreferenceBlock,
  QuestionsBlock,
  TestBlock,
  TestQuestion,
} from "@/lib/types";
import { cn, uid, randomToken } from "@/lib/utils";
import { FIGMA_FRAME_LABELS, figmaEmbedUrl } from "@/lib/tests-figma";
import { canUploadTestAssets, isTestAssetUrl, removeTestAssetByUrl, uploadTestAsset } from "@/lib/test-assets";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useApp } from "@/lib/store";

export const DEFAULT_CONSENT_TEXT =
  "This test collects your answers, task outcomes, and interaction data (clicks and screen navigation) to improve our product. " +
  "No personal data is collected and your session is anonymous. You can stop at any time by closing this tab.";

/** Fresh block of a given type, with sensible starter content. */
export function newBlock(type: TestBlock["type"]): TestBlock {
  const id = uid("b");
  switch (type) {
    case "message":
      return { id, type, title: "", bodyMd: "" };
    case "questions":
      return { id, type, questions: [newQuestion()] };
    case "first-click":
      return { id, type, instructions: "", imageUrl: "", followUpQuestions: [] };
    case "app-task":
      return { id, type, instructions: "", url: "", followUpQuestions: [] };
    case "figma-proto":
      return { id, type, instructions: "", url: "", frame: "desktop", followUpQuestions: [] };
    case "preference":
      return {
        id,
        type,
        instructions: "Which design do you prefer?",
        options: [
          { id: uid("opt"), imageUrl: "" },
          { id: uid("opt"), imageUrl: "" },
        ],
        followUpQuestions: [{ id: uid("q"), type: "open", prompt: "Why did you pick that one?" }],
      };
    case "five-second":
      return {
        id,
        type,
        imageUrl: "",
        seconds: 5,
        questions: [{ id: uid("q"), type: "open", prompt: "What do you remember seeing?" }],
      };
    case "design-feedback":
      return {
        id,
        type,
        instructions: "What do you think of this design?",
        imageUrl: "",
        questions: [
          { id: uid("q"), type: "rating", prompt: "How appealing is this design?", scale: 5 },
          { id: uid("q"), type: "open", prompt: "What would you change?" },
        ],
      };
  }
}

const newQuestion = (): TestQuestion => ({ id: uid("q"), type: "rating", prompt: "", scale: 5 });

export const BLOCK_META: Record<TestBlock["type"], { label: string; hint: string }> = {
  message: { label: "Message", hint: "Intro, context, or thanks" },
  questions: { label: "Questions", hint: "Ratings and open answers" },
  "first-click": { label: "First click", hint: "Where would you click on an image?" },
  "app-task": { label: "App task", hint: "A task in a live app or prototype" },
  "figma-proto": { label: "Figma prototype", hint: "A task or free explore in a Figma prototype" },
  preference: { label: "Preference test", hint: "Pick between design variants" },
  "five-second": { label: "Five-second test", hint: "Glimpse an image, then recall" },
  "design-feedback": { label: "Design feedback", hint: "Show a design, collect impressions" },
};

/** Identity accents per block type (accent-* classes from globals — the same
    palette the kanban lanes use, light/dark aware). Shared by the builder
    rail and the results page so a block keeps one color everywhere. */
export const BLOCK_ACCENTS: Record<TestBlock["type"], string> = {
  message: "slate",
  questions: "indigo",
  "first-click": "violet",
  "app-task": "blue",
  "figma-proto": "purple",
  preference: "pink",
  "five-second": "amber",
  "design-feedback": "teal",
};

/** One-line summary shown in the block list rail. */
export function blockSummary(b: TestBlock): string {
  switch (b.type) {
    case "message":
      return b.title || (b.isConsentGate ? "Intro & consent" : "Untitled message");
    case "questions":
      return b.questions[0]?.prompt || `${b.questions.length} question${b.questions.length === 1 ? "" : "s"}`;
    case "first-click":
      return b.instructions || "First click";
    case "app-task":
      return b.instructions || "App task";
    case "figma-proto":
      return b.instructions || "Figma prototype";
    case "preference":
      return b.instructions || "Preference test";
    case "five-second":
      return b.instructions || "Five-second test";
    case "design-feedback":
      return b.instructions || "Design feedback";
  }
}

/* ---------------- shared bits ---------------- */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {label}
    </Button>
  );
}

/** Builder-side image preview that survives problem images: broken links get
    a visible warning instead of nothing, and SVGs without intrinsic
    dimensions get width-driven sizing instead of collapsing to 0×0. */
function PreviewImage({
  src,
  alt,
  onLoad,
}: {
  src: string;
  alt: string;
  onLoad?: (img: HTMLImageElement) => void;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (failed) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface-2 p-2.5 text-xs text-warning">
        This link doesn&apos;t load as an image — participants won&apos;t see anything. Upload a screenshot or use a
        direct image link (PNG/JPEG/WebP).
      </p>
    );
  }
  // SVGs need width-driven sizing (many carry only a viewBox and collapse under
  // w-auto) and scale crisply anyway → fill. Rasters render at natural size
  // (capped, never upscaled) so a small screenshot isn't stretched into a
  // blurry box; the lightbox handles full-size viewing.
  const isSvg = /\.svg(\?|#|$)/i.test(src) || /^data:image\/svg\+xml/i.test(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        // A modest thumbnail — the builder is for setup, not viewing. Small
        // enough that a big-canvas or low-res upload never dominates the editor.
        "max-h-40 max-w-xs rounded-md border border-border object-contain",
        isSvg ? "w-full" : "w-auto",
      )}
      onError={() => setFailed(true)}
      onLoad={(e) => onLoad?.(e.currentTarget)}
    />
  );
}

/** URL input + optional Storage upload (cloud workspaces). Reused by every
    image-bearing block. */
function ImageField({
  value,
  onChange,
  testId,
  placeholder = "https://… (a screenshot of the design)",
}: {
  value: string;
  onChange: (url: string) => void;
  testId: string;
  placeholder?: string;
}) {
  const account = useApp((s) => s.account);
  const toast = useApp((s) => s.toast);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canUpload = canUploadTestAssets() && !!account;

  // An uploaded image gets a clean chip instead of its raw Storage URL; only
  // manually pasted links show (and stay editable) in the text input.
  const uploaded = isTestAssetUrl(value);

  const upload = async (file: File) => {
    setUploading(true);
    const { url, error } = await uploadTestAsset(account!.id, testId, file);
    setUploading(false);
    if (error || !url) return toast(error ?? "Upload failed.", "error");
    if (uploaded) void removeTestAssetByUrl(value); // replacing — drop the old object
    onChange(url);
  };

  const clear = () => {
    if (uploaded) void removeTestAssetByUrl(value);
    onChange("");
  };

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      {uploaded ? (
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-3">
          <ImageIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-[13px]">Uploaded screenshot</span>
          <button
            type="button"
            aria-label="Remove uploaded image"
            className="ml-auto shrink-0 rounded p-0.5 text-muted transition-colors hover:text-foreground"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {canUpload && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" className="h-9 shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : uploaded ? "Replace" : "Upload"}
          </Button>
        </>
      )}
    </div>
  );
}

function QuestionsEditor({
  questions,
  onChange,
  title = "Questions",
}: {
  questions: TestQuestion[];
  onChange: (qs: TestQuestion[]) => void;
  title?: string;
}) {
  const patch = (id: string, p: Partial<TestQuestion>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...p } : q)));

  /** Questions are asked in array order, so moving one is a plain swap —
      same idiom as reordering blocks in the builder sidebar. */
  const move = (i: number, dir: -1 | 1) => {
    const next = [...questions];
    const [q] = next.splice(i, 1);
    next.splice(i + dir, 0, q);
    onChange(next);
  };

  // Type switches set sensible defaults; a switch away keeps unrelated
  // config fields around harmlessly (jsonb — the runner reads by type).
  const switchType = (q: TestQuestion, type: TestQuestion["type"]) => {
    if (type === "rating") return patch(q.id, { type, scale: q.scale ?? 5 });
    if (type === "choice") return patch(q.id, { type, options: q.options?.length ? q.options : ["", ""], multiple: q.multiple ?? false });
    if (type === "input") return patch(q.id, { type, inputFormat: q.inputFormat ?? "text" });
    if (type === "matrix") return patch(q.id, { type, scale: q.scale ?? 5, statements: q.statements?.length ? q.statements : [""] });
    return patch(q.id, { type });
  };

  const PROMPTS: Record<TestQuestion["type"], string> = {
    rating: "How easy was this task?",
    open: "What did you expect to happen?",
    choice: "Which of these do you use most?",
    "yes-no": "Would you use this feature?",
    input: "What is your job title?",
    matrix: "How much do you agree with each statement?",
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      {questions.map((q, i) => (
        <div key={q.id} className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-2">
          <Select value={q.type} onChange={(e) => switchType(q, e.target.value as TestQuestion["type"])} className="w-32 shrink-0">
            <option value="rating">Rating</option>
            <option value="open">Open text</option>
            <option value="choice">Multiple choice</option>
            <option value="yes-no">Yes / No</option>
            <option value="input">Input</option>
            <option value="matrix">Matrix</option>
          </Select>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Input value={q.prompt} onChange={(e) => patch(q.id, { prompt: e.target.value })} placeholder={PROMPTS[q.type]} />
            {(q.type === "rating" || q.type === "matrix") && (
              <Select value={String(q.scale ?? 5)} onChange={(e) => patch(q.id, { scale: Number(e.target.value) })} className="w-32">
                <option value="5">Scale 1–5</option>
                <option value="7">Scale 1–7</option>
                <option value="10">Scale 1–10</option>
              </Select>
            )}
            {q.type === "choice" && (
              <>
                <Textarea
                  rows={3}
                  value={(q.options ?? []).join("\n")}
                  onChange={(e) => patch(q.id, { options: e.target.value.split("\n") })}
                  placeholder={"One option per line\nOption A\nOption B"}
                />
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    className="accent-[hsl(var(--primary))]"
                    checked={!!q.multiple}
                    onChange={(e) => patch(q.id, { multiple: e.target.checked })}
                  />
                  Allow selecting multiple options
                </label>
              </>
            )}
            {q.type === "input" && (
              <Select
                value={q.inputFormat ?? "text"}
                onChange={(e) => patch(q.id, { inputFormat: e.target.value as TestQuestion["inputFormat"] })}
                className="w-36"
              >
                <option value="text">Short text</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </Select>
            )}
            {q.type === "matrix" && (
              <Textarea
                rows={3}
                value={(q.statements ?? []).join("\n")}
                onChange={(e) => patch(q.id, { statements: e.target.value.split("\n") })}
                placeholder={"One statement per line\nThe app is easy to use\nThe app looks professional"}
              />
            )}
            <label className="flex items-center gap-2 text-xs text-foreground" title="Participants can't continue until this question is answered">
              <input
                type="checkbox"
                className="accent-[hsl(var(--primary))]"
                checked={!!q.required}
                onChange={(e) => patch(q.id, { required: e.target.checked || undefined })}
              />
              Required — the participant must answer
            </label>
          </div>
          {/* Reorder / remove. Always visible rather than on hover: the
              questions are asked in this order, so the control that changes it
              shouldn't be hidden. */}
          <div className="flex shrink-0 flex-col items-center">
            <button
              type="button"
              className="rounded p-1 text-subtle transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-subtle"
              disabled={i === 0}
              aria-label="Move question up"
              title="Move question up"
              onClick={() => move(i, -1)}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-subtle transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-subtle"
              disabled={i === questions.length - 1}
              aria-label="Move question down"
              title="Move question down"
              onClick={() => move(i, 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-subtle transition-colors hover:text-danger"
              aria-label="Remove question"
              title="Remove question"
              onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...questions, newQuestion()])}>
        <Plus className="h-4 w-4" /> Add question
      </Button>
    </div>
  );
}

/* ---------------- per-type editors ---------------- */

function MessageEditor({ block, onChange }: { block: MessageBlock; onChange: (b: TestBlock) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Title</Label>
        <Input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Welcome!" />
      </div>
      <div>
        <Label>Text</Label>
        <Textarea
          rows={4}
          value={block.bodyMd}
          onChange={(e) => onChange({ ...block, bodyMd: e.target.value })}
          placeholder="Explain what the participant will do and roughly how long it takes."
        />
      </div>
      <label className="flex items-start gap-2 text-[13px] text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 accent-[hsl(var(--primary))]"
          checked={!!block.isConsentGate}
          onChange={(e) =>
            onChange({
              ...block,
              isConsentGate: e.target.checked,
              consentText: e.target.checked ? block.consentText || DEFAULT_CONSENT_TEXT : block.consentText,
            })
          }
        />
        <span>
          Consent gate — the participant must accept before anything is recorded.
          <span className="block text-xs text-subtle">Every published test needs exactly one consent gate.</span>
        </span>
      </label>
      {block.isConsentGate && (
        <div>
          <Label>Consent text</Label>
          <Textarea
            rows={4}
            value={block.consentText ?? ""}
            onChange={(e) => onChange({ ...block, consentText: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function FirstClickEditor({
  block,
  onChange,
  testId,
}: {
  block: FirstClickBlock;
  onChange: (b: TestBlock) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Task</Label>
        <Textarea
          rows={2}
          value={block.instructions}
          onChange={(e) => onChange({ ...block, instructions: e.target.value })}
          placeholder="Where would you click to create a new job?"
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          rows={2}
          value={block.description ?? ""}
          onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          placeholder="Extra context for the participant — e.g. 'Imagine you just received a breakdown report.'"
        />
      </div>
      <div>
        <Label>Image</Label>
        <ImageField
          value={block.imageUrl}
          onChange={(imageUrl) => onChange({ ...block, imageUrl, imageWidth: undefined, imageHeight: undefined })}
          testId={testId}
        />
        <p className="mt-1 text-xs text-subtle">
          Upload or paste a screenshot (PNG/JPEG/WebP, max 5 MB). Images are publicly readable — no confidential
          designs. The participant clicks once on it; you get every click as a heat overlay.
        </p>
      </div>
      {block.imageUrl && (
        <PreviewImage
          src={block.imageUrl}
          alt="First-click preview"
          onLoad={(img) => {
            if (block.imageWidth !== img.naturalWidth || block.imageHeight !== img.naturalHeight) {
              onChange({ ...block, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight });
            }
          }}
        />
      )}
      <QuestionsEditor
        title="Follow-up questions (optional)"
        questions={block.followUpQuestions}
        onChange={(qs) => onChange({ ...block, followUpQuestions: qs })}
      />
    </div>
  );
}

function PreferenceEditor({
  block,
  onChange,
  testId,
}: {
  block: PreferenceBlock;
  onChange: (b: TestBlock) => void;
  testId: string;
}) {
  const patchOption = (id: string, p: Partial<PreferenceBlock["options"][number]>) =>
    onChange({ ...block, options: block.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Question</Label>
        <Input
          value={block.instructions}
          onChange={(e) => onChange({ ...block, instructions: e.target.value })}
          placeholder="Which design do you prefer?"
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          rows={2}
          value={block.description ?? ""}
          onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          placeholder="Extra context for the participant — e.g. 'Both show the same start screen.'"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Options ({block.options.length} of 4)</Label>
        {block.options.map((o, i) => (
          <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
            <div className="flex items-center gap-2">
              <Input
                value={o.label ?? ""}
                onChange={(e) => patchOption(o.id, { label: e.target.value || undefined })}
                placeholder={`Label (optional) — e.g. "Variant ${String.fromCharCode(65 + i)}"`}
                className="w-56"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove option"
                disabled={block.options.length <= 2}
                onClick={() => onChange({ ...block, options: block.options.filter((x) => x.id !== o.id) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ImageField value={o.imageUrl} onChange={(imageUrl) => patchOption(o.id, { imageUrl })} testId={testId} />
            {o.imageUrl && <PreviewImage src={o.imageUrl} alt={o.label ?? "Option"} />}
          </div>
        ))}
        {block.options.length < 4 && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...block, options: [...block.options, { id: uid("opt"), imageUrl: "" }] })}
          >
            <Plus className="h-4 w-4" /> Add option
          </Button>
        )}
      </div>
      <QuestionsEditor
        title="Follow-up questions (optional)"
        questions={block.followUpQuestions}
        onChange={(qs) => onChange({ ...block, followUpQuestions: qs })}
      />
    </div>
  );
}

function FiveSecondEditor({
  block,
  onChange,
  testId,
}: {
  block: FiveSecondBlock;
  onChange: (b: TestBlock) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Intro (optional)</Label>
        <Input
          value={block.instructions ?? ""}
          onChange={(e) => onChange({ ...block, instructions: e.target.value || undefined })}
          placeholder="You'll see a design for a few seconds — look at it as you normally would."
        />
      </div>
      <div>
        <Label>Image</Label>
        <ImageField value={block.imageUrl} onChange={(imageUrl) => onChange({ ...block, imageUrl })} testId={testId} />
      </div>
      {block.imageUrl && <PreviewImage src={block.imageUrl} alt="Five-second preview" />}
      <div>
        <Label>Visible for</Label>
        <Select
          value={String(block.seconds ?? 5)}
          onChange={(e) => onChange({ ...block, seconds: Number(e.target.value) })}
          className="w-36"
        >
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="15">15 seconds</option>
        </Select>
      </div>
      <QuestionsEditor
        title="Recall questions"
        questions={block.questions}
        onChange={(qs) => onChange({ ...block, questions: qs })}
      />
    </div>
  );
}

function DesignFeedbackEditor({
  block,
  onChange,
  testId,
}: {
  block: DesignFeedbackBlock;
  onChange: (b: TestBlock) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Question</Label>
        <Input
          value={block.instructions}
          onChange={(e) => onChange({ ...block, instructions: e.target.value })}
          placeholder="What do you think of this design?"
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          rows={2}
          value={block.description ?? ""}
          onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          placeholder="Context for the participant — e.g. 'This is the new start screen for planners.'"
        />
      </div>
      <div>
        <Label>Design image</Label>
        <ImageField value={block.imageUrl} onChange={(imageUrl) => onChange({ ...block, imageUrl })} testId={testId} />
        <p className="mt-1 text-xs text-subtle">
          Shown large in the test; participants can open it fullscreen to inspect details.
        </p>
      </div>
      {block.imageUrl && <PreviewImage src={block.imageUrl} alt="Design preview" />}
      <QuestionsEditor
        title="Feedback questions"
        questions={block.questions}
        onChange={(qs) => onChange({ ...block, questions: qs })}
      />
    </div>
  );
}

type SnippetScan =
  | { kind: "checking" }
  | { kind: "unreachable" }
  | { kind: "missing" }
  | { kind: "wrong-test" }
  | { kind: "found"; tokenConfirmed: boolean };
type LiveCheck = "idle" | "waiting" | "ok" | "timeout";

function AppTaskEditor({
  block,
  onChange,
  shareToken,
  testId,
}: {
  block: AppTaskBlock;
  onChange: (b: TestBlock) => void;
  shareToken: string;
  testId: string;
}) {
  const toast = useApp((s) => s.toast);
  const backend = useApp((s) => s.backend);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [scan, setScan] = React.useState<SnippetScan | null>(null);
  const [live, setLive] = React.useState<LiveCheck>("idle");
  const canCheck = backend === "cloud" && !!supabase && !!block.url.trim();

  const runScan = async () => {
    if (!supabase) return;
    setScan({ kind: "checking" });
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    try {
      const res = await fetch("/api/tests/check-snippet", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: block.url, shareToken }),
      });
      const j = (await res.json()) as { reachable?: boolean; found?: boolean; tokenMatches?: boolean | null; error?: string };
      if (!res.ok) {
        setScan(null);
        return toast(j.error ?? "Check failed.", "error");
      }
      if (!j.reachable) setScan({ kind: "unreachable" });
      else if (!j.found) setScan({ kind: "missing" });
      else if (j.tokenMatches === false) setScan({ kind: "wrong-test" });
      else setScan({ kind: "found", tokenConfirmed: j.tokenMatches === true });
    } catch {
      setScan(null);
      toast("Check failed.", "error");
    }
  };

  const runLiveCheck = () => {
    let target: string;
    try {
      const u = new URL(block.url);
      const checkId = randomToken(12);
      u.searchParams.set("lens", `check.${checkId}.builder`);
      target = u.toString();
      setLive("waiting");
      window.open(target, "_blank");
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const r = await fetch(`/api/tests/check-snippet?checkId=${checkId}`);
          const j = (await r.json()) as { received?: boolean };
          if (j.received) {
            clearInterval(poll);
            setLive("ok");
            return;
          }
        } catch {}
        if (tries >= 12) {
          clearInterval(poll);
          setLive("timeout");
        }
      }, 2000);
    } catch {
      toast("Enter a valid app URL first.", "error");
    }
  };

  const scanMessage: { text: string; tone: "success" | "warning" | "danger" } | null =
    scan === null || scan.kind === "checking"
      ? null
      : scan.kind === "unreachable"
        ? { text: "Couldn't reach the app URL from the server.", tone: "danger" }
        : scan.kind === "missing"
          ? {
              text: "No snippet found in the app's page or scripts — copy it in and republish. If your builder injected it in an unusual way, Test live is the definitive check.",
              tone: "danger",
            }
          : scan.kind === "wrong-test"
            ? { text: "Snippet found, but it points at a different test link.", tone: "warning" }
            : { text: scan.tokenConfirmed ? "Snippet found and pointing at this test." : "Snippet reference found.", tone: "success" };
  // A successful live check is ground truth — don't contradict it with a
  // negative static scan (JS-injected snippets can hide from the scan).
  const showScanMessage = scanMessage && !(live === "ok" && scanMessage.tone !== "success");
  const endpoint = `${origin}/api/t/${shareToken}/events`;
  const snippet = `<script>window.LENS_ENDPOINT="${endpoint}"</script>\n<script src="${origin}/lens-beacon.js"></script>`;
  const aiPrompt =
    `Add this exact HTML to my app so it runs once on every page (e.g. in the HTML entry point or a root layout). Do not modify it:\n\n${snippet}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Task</Label>
        <Textarea
          rows={2}
          value={block.instructions}
          onChange={(e) => onChange({ ...block, instructions: e.target.value })}
          placeholder="Create a new job in the app that opens."
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          rows={2}
          value={block.description ?? ""}
          onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          placeholder="Extra context for the participant — e.g. 'A boiler in building 2 just broke down; plan the repair.'"
        />
      </div>
      <div>
        <Label>App URL</Label>
        <Input
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
          placeholder="https://… (a Figma Make app, deployed prototype, or staging build)"
        />
        <p className="mt-1 text-xs text-subtle">
          Opens in a new tab. The participant reports completion themselves; add the tracking snippet below for
          automatic click and navigation data.
        </p>
      </div>
      <div>
        <Label>Preview image (optional)</Label>
        <ImageField
          value={block.previewImageUrl ?? ""}
          onChange={(url) => onChange({ ...block, previewImageUrl: url || undefined })}
          testId={testId}
          placeholder="https://… (a screenshot of the app's start page)"
        />
        <p className="mt-1 text-xs text-subtle">
          Shown to the participant before they open the app, so they recognize what the new tab will look like.
        </p>
        {block.previewImageUrl && <div className="mt-2"><PreviewImage src={block.previewImageUrl} alt="App preview" /></div>}
      </div>
      <div>
        <Label>Success page (optional)</Label>
        <Input
          value={block.successUrlPattern ?? ""}
          onChange={(e) => onChange({ ...block, successUrlPattern: e.target.value || undefined })}
          placeholder="/job-created*"
        />
        <p className="mt-1 text-xs text-subtle">
          With the snippet installed, reaching a page matching this path counts the task as completed automatically
          (* matches anything). Participants never see this value.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <p className="text-[13px] font-medium text-foreground">Tracking snippet</p>
        <p className="mt-0.5 text-xs text-muted">
          Paste into your app — or let your AI builder do it (works for Figma Make, Lovable, v0, or any app you can
          edit). Without it, the task still works via self-report.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface p-2 text-[11px] leading-relaxed text-muted">
          {snippet}
        </pre>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton text={snippet} label="Copy snippet" />
          <CopyButton text={aiPrompt} label="Copy AI prompt" />
          {canCheck && (
            <>
              <Button variant="outline" size="sm" disabled={scan?.kind === "checking"} onClick={() => void runScan()}>
                <ScanSearch className="h-4 w-4" /> {scan?.kind === "checking" ? "Checking…" : "Check snippet"}
              </Button>
              <Button variant="outline" size="sm" disabled={live === "waiting"} onClick={runLiveCheck}>
                <Radio className="h-4 w-4" /> {live === "waiting" ? "Waiting for beacon…" : "Test live"}
              </Button>
            </>
          )}
        </div>
        {showScanMessage && scanMessage && (
          <p
            className={`mt-2 text-xs font-medium ${
              scanMessage.tone === "success" ? "text-success" : scanMessage.tone === "warning" ? "text-warning" : "text-danger"
            }`}
          >
            {scanMessage.text}
          </p>
        )}
        {live === "ok" && <p className="mt-2 text-xs font-medium text-success">Beacon received — tracking works end to end.</p>}
        {live === "timeout" && (
          <p className="mt-2 text-xs font-medium text-danger">
            Nothing received — the snippet may be missing, not executing, or pointing elsewhere.
          </p>
        )}
        {live === "waiting" && (
          <p className="mt-2 text-xs text-muted">Let the app finish loading in the new tab — listening for the beacon…</p>
        )}
        {origin.startsWith("http://localhost") && (
          <button
            className="mt-2 text-left text-xs text-warning underline-offset-2 hover:underline"
            onClick={() => toast("Published apps can't reach localhost from Safari; use Chrome while developing.", "info")}
          >
            Testing against localhost?
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Route screenshots (optional)</Label>
        <p className="-mt-1 text-xs text-subtle">
          Attach a screenshot per app route and the results page paints participants&apos; clicks over it as a heatmap.
          Patterns work like the success page (* matches anything).
        </p>
        {(block.routeScreenshots ?? []).map((rs, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
            <div className="flex items-center gap-2">
              <Input
                value={rs.pattern}
                onChange={(e) => {
                  const next = [...(block.routeScreenshots ?? [])];
                  next[i] = { ...rs, pattern: e.target.value };
                  onChange({ ...block, routeScreenshots: next });
                }}
                placeholder="/jobs/new* (empty = all pages)"
                className="w-64 font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove screenshot"
                onClick={() =>
                  onChange({ ...block, routeScreenshots: (block.routeScreenshots ?? []).filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ImageField
              value={rs.imageUrl}
              onChange={(imageUrl) => {
                const next = [...(block.routeScreenshots ?? [])];
                next[i] = { ...rs, imageUrl };
                onChange({ ...block, routeScreenshots: next });
              }}
              testId={testId}
              placeholder="https://… (full-page screenshot of this route)"
            />
            {rs.imageUrl && <PreviewImage src={rs.imageUrl} alt={`Screenshot for ${rs.pattern || "all pages"}`} />}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            onChange({ ...block, routeScreenshots: [...(block.routeScreenshots ?? []), { pattern: "", imageUrl: "" }] })
          }
        >
          <Plus className="h-4 w-4" /> Add route screenshot
        </Button>
      </div>
      <QuestionsEditor
        title="Follow-up questions (optional)"
        questions={block.followUpQuestions}
        onChange={(qs) => onChange({ ...block, followUpQuestions: qs })}
      />
    </div>
  );
}

type ShareCheck =
  | { kind: "checking" }
  | { kind: "unreachable" }
  | { kind: "private" }
  | { kind: "shared"; title?: string };

const TASK_TYPES = [
  { key: "goal" as const, Icon: Trophy, label: "Goal-based", hint: "They try to finish a task and report how it went" },
  { key: "explore" as const, Icon: Compass, label: "Free explore", hint: "No success or failure — they look around and answer" },
];

function FigmaProtoEditor({
  block,
  onChange,
}: {
  block: FigmaProtoBlock;
  onChange: (b: TestBlock) => void;
}) {
  const toast = useApp((s) => s.toast);
  const backend = useApp((s) => s.backend);
  const [check, setCheck] = React.useState<ShareCheck | null>(null);
  const explore = block.taskType === "explore";
  const [showPreview, setShowPreview] = React.useState(false);
  const embedUrl = figmaEmbedUrl(block.url);
  const looksFigma = !block.url.trim() || embedUrl !== null;
  const canCheck = backend === "cloud" && !!supabase && embedUrl !== null;

  // A pasted link is stale the moment it changes — don't keep showing a verdict
  // for a different prototype.
  React.useEffect(() => setCheck(null), [block.url]);

  const runCheck = async () => {
    if (!supabase) return;
    setCheck({ kind: "checking" });
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    try {
      const res = await fetch("/api/tests/check-figma", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: block.url }),
      });
      const j = (await res.json()) as { shared?: boolean; title?: string; error?: string };
      if (!res.ok) {
        setCheck(null);
        return toast(j.error ?? "Check failed.", "error");
      }
      setCheck(j.shared ? { kind: "shared", title: j.title } : { kind: "private" });
    } catch {
      setCheck({ kind: "unreachable" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Task type</Label>
        <div className="mt-1 grid grid-cols-2 gap-2.5">
          {TASK_TYPES.map((t) => {
            const selected = (block.taskType ?? "goal") === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange(
                    t.key === "goal"
                      ? { ...block, taskType: undefined }
                      : {
                          ...block,
                          taskType: "explore",
                          // Explore records no outcome, so it needs a question
                          // to collect anything — seed one rather than warn.
                          followUpQuestions: block.followUpQuestions.length
                            ? block.followUpQuestions
                            : [{ id: uid("q"), type: "open", prompt: "What stood out to you?" }],
                        },
                  )
                }
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary-soft/30" : "border-border bg-surface hover:border-primary/40",
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <t.Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-subtle")} />
                  {t.label}
                </span>
                <span className="text-xs leading-snug text-subtle">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label>{explore ? "What should they explore?" : "Task"}</Label>
        <Textarea
          rows={2}
          value={block.instructions}
          onChange={(e) => onChange({ ...block, instructions: e.target.value })}
          placeholder={
            explore
              ? "Have a look around the planning screen — no particular goal."
              : "Book a service visit for the broken boiler in building 2."
          }
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          rows={2}
          value={block.description ?? ""}
          onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          placeholder="Extra context for the participant — e.g. 'You're the planner on duty this morning.'"
        />
      </div>
      <div>
        <Label>Prototype link</Label>
        <Input
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
          placeholder="https://www.figma.com/proto/…"
          className={cn(!looksFigma && "border-danger")}
        />
        {/* One line only. The reasoning behind the two checks lives in their
            result messages — the moment it's actually worth reading. */}
        <p className="mt-1 text-xs text-subtle">
          Share it in Figma as <span className="font-medium text-muted">anyone with the link can view</span>.
        </p>
        {!looksFigma && (
          <p className="mt-1 text-xs font-medium text-danger">
            Not a Figma link — for a live app or a Figma Make build, use an App task block.
          </p>
        )}
        {(canCheck || embedUrl) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {canCheck && (
              <Button variant="outline" size="sm" disabled={check?.kind === "checking"} onClick={() => void runCheck()}>
                <ScanSearch className="h-4 w-4" /> {check?.kind === "checking" ? "Checking…" : "Check sharing"}
              </Button>
            )}
            {embedUrl && (
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4" /> Check the prototype
              </Button>
            )}
          </div>
        )}
        {check?.kind === "shared" && (
          <p className="mt-2 text-xs font-medium text-success">
            Participants can open it{check.title ? ` — “${check.title}”` : ""}.
          </p>
        )}
        {check?.kind === "private" && (
          <p className="mt-2 text-xs font-medium text-danger">
            Participants can&apos;t open this — it previews for you because you&apos;re signed in to Figma. In Figma:
            Share → link access → anyone with the link.
          </p>
        )}
        {check?.kind === "unreachable" && (
          <p className="mt-2 text-xs font-medium text-warning">Couldn&apos;t reach Figma — try again.</p>
        )}
      </div>
      <div>
        <Label>Stage size</Label>
        <Select
          value={block.frame ?? "desktop"}
          onChange={(e) => onChange({ ...block, frame: e.target.value as FigmaProtoBlock["frame"] })}
          className="w-40"
        >
          {(["phone", "tablet", "desktop"] as const).map((f) => (
            <option key={f} value={f}>
              {FIGMA_FRAME_LABELS[f]}
            </option>
          ))}
        </Select>
      </div>
      <Modal
        open={showPreview && !!embedUrl}
        onClose={() => setShowPreview(false)}
        title="Prototype check"
        description="Read-only — this confirms the right prototype loads. Preview the test to interact with it."
        className="max-w-[min(1200px,92vw)]"
      >
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
          <iframe
            src={embedUrl ?? undefined}
            title="Figma prototype preview"
            tabIndex={-1}
            className="pointer-events-none block h-[min(70vh,760px)] w-full"
          />
        </div>
      </Modal>
      {/* A footnote, not a panel: sets expectations once without competing with
          the fields. The Embed-API reasoning is in docs/unmoderated-testing.md
          and repeated on the results page, where it lands in context. */}
      <p className="text-xs text-subtle">
        {explore ? "Records time in the prototype and the answers below." : "Records completion, time on task and answers."}{" "}
        No click paths — Figma doesn&apos;t report those for participants. Use an App task block for click data.
      </p>
      <QuestionsEditor
        title={explore ? "Questions" : "Follow-up questions (optional)"}
        questions={block.followUpQuestions}
        onChange={(qs) => onChange({ ...block, followUpQuestions: qs })}
      />
      {explore && block.followUpQuestions.length === 0 && (
        <p className="-mt-2 text-xs font-medium text-warning">
          A free-explore block records no outcome, so without a question it collects nothing but time.
        </p>
      )}
    </div>
  );
}

/* ---------------- dispatcher ---------------- */

export function BlockEditor({
  block,
  onChange,
  shareToken,
  testId,
}: {
  block: TestBlock;
  onChange: (b: TestBlock) => void;
  shareToken: string;
  testId: string;
}) {
  switch (block.type) {
    case "message":
      return <MessageEditor block={block} onChange={onChange} />;
    case "questions":
      return (
        <QuestionsEditor questions={block.questions} onChange={(qs) => onChange({ ...block, questions: qs } as QuestionsBlock)} />
      );
    case "first-click":
      return <FirstClickEditor block={block} onChange={onChange} testId={testId} />;
    case "app-task":
      return <AppTaskEditor block={block} onChange={onChange} shareToken={shareToken} testId={testId} />;
    case "figma-proto":
      return <FigmaProtoEditor block={block} onChange={onChange} />;
    case "preference":
      return <PreferenceEditor block={block} onChange={onChange} testId={testId} />;
    case "five-second":
      return <FiveSecondEditor block={block} onChange={onChange} testId={testId} />;
    case "design-feedback":
      return <DesignFeedbackEditor block={block} onChange={onChange} testId={testId} />;
  }
}
