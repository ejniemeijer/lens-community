"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlignLeft,
  AppWindow,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  Frame,
  Images,
  MessageCircleQuestion,
  MessageSquareText,
  MoreHorizontal,
  MousePointerClick,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { getTest, getProject, projects, tests } from "@/lib/db";
import type { TestBlock } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { can, liveTestLimitFor } from "@/lib/permissions";
import { cn, randomToken, testShareUrl, uid } from "@/lib/utils";
import { askAIJson, checkAiConfigured, AiError } from "@/lib/ai";
import { buildBlocksFromGenerated, GENERATE_SYSTEM, generateUserMessage, type GeneratedTest } from "@/lib/tests-ai";
import { figmaEmbedUrl } from "@/lib/tests-figma";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { BLOCK_ACCENTS, BLOCK_META, BlockEditor, blockSummary, newBlock } from "@/components/tests/block-editors";
import { TEST_STATUS_META } from "@/components/tests/test-views";
import { TestRunner } from "@/app/t/[token]/runner";

const BLOCK_ICONS: Record<TestBlock["type"], LucideIcon> = {
  message: AlignLeft,
  questions: MessageCircleQuestion,
  "first-click": MousePointerClick,
  "app-task": AppWindow,
  "figma-proto": Frame,
  preference: Images,
  "five-second": Timer,
  "design-feedback": MessageSquareText,
};

/** Virtual width the glance runner renders at before being scaled to fit. */
const GLANCE_W = 480;

/** Scales its child to the panel's width (never up) so the preview always
    fills the panel — no matter the block's height. Tall blocks are capped at
    ~60% of the viewport and softly faded at the bottom rather than shrunk,
    which would leave a side gap. Width-only scale keeps every block edge to
    edge, so short and tall blocks look consistent. */
function GlanceFit({ children, dep }: { children: React.ReactNode; dep: string }) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState({ scale: 0, height: 0, clipped: false });

  React.useEffect(() => {
    const el = inner.current;
    const measure = () => {
      const o = outer.current;
      const i = inner.current;
      if (!o || !i) return;
      const ow = o.offsetWidth;
      if (ow < 1) return; // layout not settled (or pane glitch) — keep last good scale
      const maxH = Math.round(window.innerHeight * 0.6);
      const scale = Math.min(1, ow / GLANCE_W); // width-fill only
      const full = i.offsetHeight * scale;
      setFit({ scale, height: Math.ceil(Math.min(full, maxH)), clipped: full > maxH + 1 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el) {
      ro.observe(el);
      // Images inside the block grow the content after mount — `load` doesn't
      // bubble, so listen in the capture phase.
      el.addEventListener("load", measure, true);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      el?.removeEventListener("load", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [dep]);

  return (
    <div ref={outer} className="relative overflow-hidden" style={{ height: fit.height || undefined }}>
      <div ref={inner} style={{ width: GLANCE_W, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
      {fit.clipped && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />
      )}
    </div>
  );
}

export default function TestBuilderPage() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const backend = useApp((s) => s.backend);
  const account = useApp((s) => s.account);
  const updateTest = useApp((s) => s.updateTest);
  const deleteTest = useApp((s) => s.deleteTest);
  const toast = useApp((s) => s.toast);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showRename, setShowRename] = React.useState(false);
  const [renameTo, setRenameTo] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  // Illustrative "participant glance" side panel (xl screens only) — shows
  // how the selected block looks, without being a functional walkthrough.
  const [showGlance, setShowGlance] = React.useState(true);
  React.useEffect(() => {
    try {
      setShowGlance(localStorage.getItem("lens-builder-glance") !== "off");
    } catch {}
  }, []);
  const toggleGlance = () =>
    setShowGlance((v) => {
      const next = !v;
      try {
        localStorage.setItem("lens-builder-glance", next ? "on" : "off");
      } catch {}
      return next;
    });
  // AI test generator — cloud + editor role + use-ai + a configured key.
  const [aiConfigured, setAiConfigured] = React.useState(false);
  React.useEffect(() => {
    if (backend !== "cloud" || !can(role, "use-ai")) return;
    let cancelled = false;
    void checkAiConfigured().then((ok) => !cancelled && setAiConfigured(ok));
    return () => {
      cancelled = true;
    };
  }, [backend, role]);
  const [showGenerate, setShowGenerate] = React.useState(false);
  const [goal, setGoal] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  const test = getTest(id);
  if (!test) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const project = getProject(test.projectId);
  const blocks = test.blocks;
  const selected = blocks.find((b) => b.id === selectedId) ?? blocks[0];
  const shareUrl = testShareUrl(test.shareToken);

  const setBlocks = (next: TestBlock[]) => updateTest(test.id, { blocks: next });
  const patchBlock = (b: TestBlock) => setBlocks(blocks.map((x) => (x.id === b.id ? b : x)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + dir, 0, b);
    setBlocks(next);
  };
  const addBlock = (type: TestBlock["type"]) => {
    const b = newBlock(type);
    setBlocks([...blocks, b]);
    setSelectedId(b.id);
  };
  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter((b) => b.id !== blockId));
    if (selectedId === blockId) setSelectedId(null);
  };

  const canGenerate = canManage && backend === "cloud" && can(role, "use-ai") && aiConfigured;
  const runGenerate = async () => {
    if (!goal.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const gen = await askAIJson<GeneratedTest>({
        system: GENERATE_SYSTEM,
        messages: [{ role: "user", content: generateUserMessage(goal.trim()) }],
        maxTokens: 1400,
      });
      let built = buildBlocksFromGenerated(gen, uid);
      if (!built.length) throw new AiError("The AI didn't return any blocks. Try rephrasing the goal.", 502);
      // Never create a second consent gate — the test already has one.
      if (blocks.some((b) => b.type === "message" && b.isConsentGate)) {
        built = built.map((b) => (b.type === "message" && b.isConsentGate ? { ...b, isConsentGate: false } : b));
      }
      setBlocks([...blocks, ...built]);
      setSelectedId(built[0].id);
      setShowGenerate(false);
      setGoal("");
      toast(`Added ${built.length} block${built.length === 1 ? "" : "s"} — review and add your images or app URLs.`, "success");
    } catch (e) {
      setGenError(e instanceof AiError ? e.message : "Couldn't generate the test. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const questionProblem = (qs: { prompt: string; type: string; options?: string[]; statements?: string[] }[]): string | null => {
    for (const q of qs) {
      if (!q.prompt.trim()) return "A question is missing its prompt.";
      if (q.type === "choice" && (q.options ?? []).map((o) => o.trim()).filter(Boolean).length < 2)
        return `The multiple-choice question “${q.prompt}” needs at least two options.`;
      if (q.type === "matrix" && (q.statements ?? []).map((s) => s.trim()).filter(Boolean).length < 1)
        return `The matrix question “${q.prompt}” needs at least one statement.`;
    }
    return null;
  };

  const publishProblem = (): string | null => {
    if (blocks.length === 0) return "Add at least one block before publishing.";
    if (!blocks.some((b) => b.type === "message" && b.isConsentGate))
      return "Every test needs a consent gate — enable it on a message block.";
    for (const b of blocks) {
      if (b.type === "app-task" && !b.url.trim()) return "An app task is missing its URL.";
      if (b.type === "figma-proto") {
        if (!b.url.trim()) return "A Figma prototype block is missing its prototype link.";
        if (!figmaEmbedUrl(b.url)) return "A Figma prototype block has a link that isn't a Figma prototype URL.";
        // No outcome is recorded in explore mode, so a question is the only
        // thing that makes the block collect anything.
        if (b.taskType === "explore" && !b.followUpQuestions.length)
          return "A free-explore prototype block needs at least one question.";
      }
      if (b.type === "first-click" && !b.imageUrl.trim()) return "A first-click block is missing its image.";
      if (b.type === "preference" && (b.options.length < 2 || b.options.some((o) => !o.imageUrl.trim())))
        return "A preference test needs at least two options, each with an image.";
      if (b.type === "five-second") {
        if (!b.imageUrl.trim()) return "A five-second test is missing its image.";
        if (!b.questions.length) return "A five-second test needs at least one recall question.";
      }
      if (b.type === "design-feedback") {
        if (!b.imageUrl.trim()) return "A design-feedback block is missing its image.";
        if (!b.questions.length) return "A design-feedback block needs at least one feedback question.";
      }
      const qs =
        b.type === "questions" || b.type === "five-second" || b.type === "design-feedback"
          ? b.questions
          : b.type === "message"
            ? []
            : b.followUpQuestions;
      const problem = questionProblem(qs);
      if (problem) return problem;
    }
    // Concurrent-live-test cap per plan (docs/unmoderated-testing.md).
    const liveLimit = liveTestLimitFor(account?.plan);
    const liveOthers = tests.filter((t) => t.id !== test.id && t.status === "active").length;
    if (liveOthers >= liveLimit)
      return liveLimit === 1
        ? "The Starter plan runs one live test at a time — close the other test first."
        : `Your plan runs ${liveLimit} live tests at a time — close one first.`;
    return null;
  };

  const publish = () => {
    const problem = publishProblem();
    if (problem) return toast(problem, "error");
    updateTest(test.id, { status: "active", closedAt: null });
    toast("Test is live — share the link to start collecting sessions.", "success");
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tests", href: "/tests" }, { label: test.name }]}
        title={test.name}
        description={
          <div className="flex flex-wrap items-center gap-x-1.5">
            {canManage ? (
              /* The project a test belongs to used to be fixed at creation.
                 It's just a field — nothing else keys off it — so it's editable
                 here, where you'd look for it. */
              <Menu className="inline-block">
                <MenuTrigger>
                  <button
                    type="button"
                    className="-mx-1 flex max-w-[20rem] items-center gap-1 rounded px-1 transition-colors hover:bg-surface-hover hover:text-foreground"
                    title="Move this test to another project"
                  >
                    <span className="truncate">{project?.name ?? "No project"}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
                  </button>
                </MenuTrigger>
                <MenuContent align="start" className="max-h-72 overflow-auto">
                  <MenuLabel>Move to project</MenuLabel>
                  {projects.map((pr) => (
                    <MenuItem
                      key={pr.id}
                      active={pr.id === test.projectId}
                      onSelect={() => updateTest(test.id, { projectId: pr.id })}
                    >
                      {pr.name}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            ) : (
              <span>{project?.name ?? "—"}</span>
            )}
            <span aria-hidden>·</span>
            <span>
              {blocks.length} block{blocks.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <>
            {test.status !== "draft" && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60"
                onClick={() => router.push(`/tests/${test.id}/results`)}
              >
                <BarChart3 className="h-4 w-4" /> Results
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/tests/${test.id}/preview`)}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            {canManage && (
            <>
              {test.status === "active" && (
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copy link
                </Button>
              )}
              {test.status === "draft" && (
                <Button variant="primary" size="sm" onClick={publish}>Publish</Button>
              )}
              {test.status === "active" && (
                <Button variant="outline" size="sm" onClick={() => updateTest(test.id, { status: "closed", closedAt: new Date().toISOString() })}>
                  Close test
                </Button>
              )}
              {test.status === "closed" && (
                <Button variant="primary" size="sm" onClick={publish}>Reopen</Button>
              )}
              <Menu>
                <MenuTrigger>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => { setRenameTo(test.name); setShowRename(true); }}>
                    Rename
                  </MenuItem>
                  <MenuItem icon={<RefreshCw className="h-4 w-4" />} onSelect={() => setConfirmRotate(true)}>
                    Rotate share link
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setConfirmDelete(true)}>
                    Delete test
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pb-4">
          <Badge tone={TEST_STATUS_META[test.status].tone} dot>
            {TEST_STATUS_META[test.status].label}
          </Badge>
          {test.status === "active" && (
            <code className="min-w-0 max-w-full truncate rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">{shareUrl}</code>
          )}
          {test.status !== "draft" && (
            <span className="flex w-full items-start gap-1.5 text-xs text-warning sm:w-auto">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Results may exist — changing blocks or the prototype skews comparisons.
            </span>
          )}
        </div>
      </PageHeader>

      <PageBody wide>
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Block rail */}
          <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
            {blocks.map((b, i) => {
              const Icon = BLOCK_ICONS[b.type];
              const active = selected?.id === b.id;
              return (
                <div
                  key={b.id}
                  className={cn(
                    `accent-${BLOCK_ACCENTS[b.type]}`,
                    // Same identity accent as the results page: colored left
                    // edge + tinted icon chip per block type. The left-edge
                    // color comes last so the active border doesn't merge it away.
                    "group flex cursor-pointer items-center gap-2.5 rounded-lg border border-l-[3px] p-2.5",
                    active ? "border-primary bg-primary-soft/40" : "border-border bg-surface hover:border-border-strong",
                    "border-l-[hsl(var(--a-solid))]",
                  )}
                  onClick={() => setSelectedId(b.id)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--a-bg))]" aria-hidden>
                    <Icon className="h-3.5 w-3.5 text-[hsl(var(--a-fg))]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{blockSummary(b)}</p>
                    <p className="text-2xs text-subtle">{BLOCK_META[b.type].label}</p>
                  </div>
                  {canManage && (
                    <span className="hidden shrink-0 items-center group-hover:flex">
                      <button
                        className="rounded p-1 text-subtle hover:text-foreground disabled:opacity-30"
                        disabled={i === 0}
                        aria-label="Move up"
                        onClick={(e) => { e.stopPropagation(); move(i, -1); }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-subtle hover:text-foreground disabled:opacity-30"
                        disabled={i === blocks.length - 1}
                        aria-label="Move down"
                        onClick={(e) => { e.stopPropagation(); move(i, 1); }}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-subtle hover:text-danger"
                        aria-label="Delete block"
                        onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
            {canManage && (
              <Menu>
                <MenuTrigger>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Plus className="h-4 w-4" /> Add block
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {(Object.keys(BLOCK_META) as TestBlock["type"][]).map((type) => {
                    const Icon = BLOCK_ICONS[type];
                    return (
                      <MenuItem
                        key={type}
                        icon={
                          <span className={cn(`accent-${BLOCK_ACCENTS[type]}`, "flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--a-bg))]")} aria-hidden>
                            <Icon className="h-3.5 w-3.5 text-[hsl(var(--a-fg))]" />
                          </span>
                        }
                        onSelect={() => addBlock(type)}
                      >
                        <span className="flex flex-col">
                          <span>{BLOCK_META[type].label}</span>
                          <span className="text-2xs text-subtle">{BLOCK_META[type].hint}</span>
                        </span>
                      </MenuItem>
                    );
                  })}
                </MenuContent>
              </Menu>
            )}
            {canGenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-primary hover:bg-primary-soft/40"
                onClick={() => { setGenError(null); setShowGenerate(true); }}
              >
                <Sparkles className="h-4 w-4" /> Generate with AI
              </Button>
            )}
          </div>

          {/* Editor pane */}
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-4">
            {selected ? (
              canManage ? (
                <BlockEditor key={selected.id} block={selected} onChange={patchBlock} shareToken={test.shareToken} testId={test.id} />
              ) : (
                <p className="text-[13px] text-subtle">Viewing only — your role can&apos;t edit tests.</p>
              )
            ) : (
              <p className="text-[13px] text-subtle">Add a block to start building the test.</p>
            )}
          </div>

          {/* Participant glance — an illustrative, non-interactive rendering of
              the selected block inside a mock browser tab. The real runner does
              the rendering (embed mode), so it can never drift from what
              participants actually see; the full walkthrough stays on Preview. */}
          {showGlance && selected && (
            <div className="hidden w-[380px] shrink-0 xl:block">
              <div className="sticky top-20 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
                  <span className="flex shrink-0 gap-1.5" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </span>
                  <span className="flex min-w-0 flex-1 justify-center">
                    <code className="truncate rounded-full border border-border bg-surface px-2.5 py-0.5 text-2xs text-subtle">
                      …/t/{test.shareToken.slice(0, 8)}…
                    </code>
                  </span>
                  <button
                    className="shrink-0 rounded p-1 text-subtle transition-colors hover:text-foreground"
                    aria-label="Hide participant glance"
                    title="Hide panel"
                    onClick={toggleGlance}
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                </div>
                <div className="pointer-events-none select-none" aria-hidden>
                  <GlanceFit dep={JSON.stringify(selected)}>
                    <TestRunner
                      key={JSON.stringify(selected)}
                      token="glance"
                      preview
                      embed
                      initialDefinition={{ name: test.name, blocks: [selected] }}
                      hasEmbeddedProto={blocks.some((b) => b.type === "figma-proto")}
                    />
                  </GlanceFit>
                </div>
                <p className="border-t border-border bg-surface-2 px-3 py-2 text-center text-2xs text-subtle">
                  How this step looks — for the real flow, use{" "}
                  <button className="font-medium text-primary hover:underline" onClick={() => router.push(`/tests/${test.id}/preview`)}>
                    Preview
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Collapsed glance: a slim rail where the panel was, so the way
              back is right where the panel disappeared. */}
          {!showGlance && selected && (
            <div className="hidden shrink-0 xl:block">
              <div className="sticky top-20">
                <Button variant="outline" size="icon" aria-label="Show participant glance" title="Show participant glance" onClick={toggleGlance}>
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageBody>

      <Modal
        open={showGenerate}
        onClose={() => !generating && setShowGenerate(false)}
        title="Generate a test with AI"
        footer={
          <>
            <Button variant="outline" size="sm" disabled={generating} onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={generating || !goal.trim()} onClick={runGenerate}>
              {generating ? "Generating…" : <><Sparkles className="h-4 w-4" /> Generate</>}
            </Button>
          </>
        }
      >
        <Label>What do you want to learn?</Label>
        <Textarea
          autoFocus
          rows={4}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Find out whether people can book a car service and choose a garage without help — and which garage-card layout reads more clearly."
        />
        <p className="mt-2 text-xs text-subtle">
          AI proposes a set of blocks you can edit. It writes the tasks and questions — you add images and app URLs.
          Generated blocks are appended to this test.
        </p>
        {genError && <p className="mt-2 text-xs font-medium text-danger">{genError}</p>}
      </Modal>

      <Modal
        open={showRename}
        onClose={() => setShowRename(false)}
        title="Rename test"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowRename(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!renameTo.trim()}
              onClick={() => { updateTest(test.id, { name: renameTo.trim() }); setShowRename(false); }}
            >
              Save
            </Button>
          </>
        }
      >
        <Label>Name</Label>
        <Input autoFocus value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Rotate the share link?"
        body={<>The current link stops working immediately — anyone who has it can no longer open the test. Existing results are kept.</>}
        confirmLabel="Rotate link"
        onConfirm={() => {
          updateTest(test.id, { shareToken: randomToken() });
          toast("Share link rotated — copy the new one.", "info");
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title={`Delete “${test.name}”?`}
        body={<>This permanently removes the test <strong>and every participant session recorded for it</strong>. This cannot be undone.</>}
        confirmLabel="Delete test"
        onConfirm={() => {
          const name = test.name;
          setLeaving(true);
          router.push("/tests");
          deleteTest(test.id); // store cleans up sessions (DB cascade) + uploaded images
          toast(`Test “${name}” deleted`, "info");
        }}
      />
    </>
  );
}
