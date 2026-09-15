import type { TestBlock, TestQuestion } from "@/lib/types";

/**
 * AI-over-tests contracts — pure (type-only imports), so they're unit-testable
 * and free of the client AI layer. Two features:
 *   1. generate-a-test-from-a-prompt (builder)
 *   2. summarize open-ended answers (results)
 * The components (block-editors builder / question-results) run these through
 * lib/ai's askAIJson.
 */

/* ---------------- 1. generate a test ---------------- */

/** The constrained "intent" the model returns — deliberately NOT our internal
    block shapes. It proposes WHAT; buildBlocksFromGenerated constructs valid
    blocks (real ids, defaults) locally, so a hallucinated shape can't corrupt
    the test. Media (images, app URLs, preference options) is left for the
    researcher to fill in. */
export interface GeneratedQuestion {
  type: TestQuestion["type"];
  prompt: string;
  scale?: number;
  options?: string[];
  statements?: string[];
  multiple?: boolean;
}
export interface GeneratedBlock {
  type: TestBlock["type"];
  title?: string;
  body?: string;
  consentGate?: boolean;
  consentText?: string;
  instructions?: string;
  description?: string;
  questions?: GeneratedQuestion[];
}
export interface GeneratedTest {
  name?: string;
  blocks: GeneratedBlock[];
}

const QUESTION_TYPES: TestQuestion["type"][] = ["rating", "open", "choice", "yes-no", "input", "matrix"];
const BLOCK_TYPES: TestBlock["type"][] = [
  "message", "questions", "first-click", "app-task", "figma-proto", "preference", "five-second", "design-feedback",
];

const cleanQuestion = (q: GeneratedQuestion, makeId: (p: string) => string): TestQuestion => {
  const type = QUESTION_TYPES.includes(q.type) ? q.type : "open";
  const out: TestQuestion = { id: makeId("q"), type, prompt: String(q.prompt ?? "").slice(0, 300) };
  if (type === "rating" || type === "matrix") out.scale = typeof q.scale === "number" ? Math.min(10, Math.max(2, q.scale)) : 5;
  if (type === "choice" && Array.isArray(q.options)) out.options = q.options.slice(0, 8).map((o) => String(o).slice(0, 120));
  if (type === "choice" && q.multiple) out.multiple = true;
  if (type === "matrix" && Array.isArray(q.statements)) out.statements = q.statements.slice(0, 10).map((s) => String(s).slice(0, 160));
  return out;
};

/**
 * Map the model's intent to valid TestBlock[]. Pure: `makeId` is injected
 * (the caller passes lib/utils' uid). Unknown block types are dropped; every
 * block gets a fresh id and safe defaults, so the result is always publishable
 * after the researcher adds media.
 */
export function buildBlocksFromGenerated(gen: GeneratedTest, makeId: (p: string) => string): TestBlock[] {
  const out: TestBlock[] = [];
  for (const g of gen.blocks ?? []) {
    if (!BLOCK_TYPES.includes(g.type)) continue;
    const id = makeId("b");
    const qs = (g.questions ?? []).map((q) => cleanQuestion(q, makeId));
    const instr = String(g.instructions ?? "").slice(0, 400);
    const desc = g.description ? String(g.description).slice(0, 400) : undefined;
    switch (g.type) {
      case "message":
        out.push({
          id, type: "message",
          title: String(g.title ?? "Welcome").slice(0, 200),
          bodyMd: String(g.body ?? "").slice(0, 2000),
          ...(g.consentGate ? { isConsentGate: true, consentText: String(g.consentText ?? "This test records your answers and anonymous interaction data. No personal data is collected.").slice(0, 2000) } : {}),
        });
        break;
      case "questions":
        out.push({ id, type: "questions", questions: qs.length ? qs : [cleanQuestion({ type: "open", prompt: "" }, makeId)] });
        break;
      case "first-click":
        out.push({ id, type: "first-click", instructions: instr, ...(desc ? { description: desc } : {}), imageUrl: "", followUpQuestions: qs });
        break;
      case "app-task":
        out.push({ id, type: "app-task", instructions: instr, ...(desc ? { description: desc } : {}), url: "", followUpQuestions: qs });
        break;
      case "figma-proto":
        out.push({ id, type: "figma-proto", instructions: instr, ...(desc ? { description: desc } : {}), url: "", frame: "desktop", followUpQuestions: qs });
        break;
      case "preference":
        out.push({
          id, type: "preference",
          instructions: instr || "Which design do you prefer?",
          ...(desc ? { description: desc } : {}),
          options: [{ id: makeId("opt"), imageUrl: "" }, { id: makeId("opt"), imageUrl: "" }],
          followUpQuestions: qs,
        });
        break;
      case "five-second":
        out.push({ id, type: "five-second", ...(instr ? { instructions: instr } : {}), imageUrl: "", seconds: 5, questions: qs.length ? qs : [cleanQuestion({ type: "open", prompt: "What do you remember seeing?" }, makeId)] });
        break;
      case "design-feedback":
        out.push({ id, type: "design-feedback", instructions: instr || "What do you think of this design?", ...(desc ? { description: desc } : {}), imageUrl: "", questions: qs.length ? qs : [cleanQuestion({ type: "open", prompt: "What's your impression?" }, makeId)] });
        break;
    }
  }
  return out;
}

export const GENERATE_SYSTEM = [
  "You design unmoderated usability tests. Given a research goal, propose a short, focused test as an ordered list of blocks.",
  "Block types: message (intro/consent), first-click (one screenshot, 'where would you tap'), app-task (a task in a live app or deployed prototype, opened in a new tab), figma-proto (a task in a Figma prototype embedded in the page), preference (compare designs), five-second (glimpse recall), questions (ratings/open/choice/yes-no), design-feedback (react to one design).",
  "Rules:",
  "- ALWAYS start with a message block that has consentGate:true.",
  "- Keep it tight: 3–6 blocks total. Completion drops with length.",
  "- Write tasks as goals, never naming buttons (test findability, not reading).",
  "- Do NOT invent image URLs, app URLs, or preference options — the researcher adds media. Provide only text (titles, instructions, questions).",
  "- Question types: rating (needs scale, default 5), open, choice (needs options[]), yes-no, input, matrix (needs statements[]).",
  'Return JSON: {"name": string, "blocks": [{"type": ..., "title"?, "body"?, "consentGate"?, "consentText"?, "instructions"?, "description"?, "questions"?: [{"type","prompt","scale"?,"options"?,"statements"?,"multiple"?}]}]}',
].join("\n");

export const generateUserMessage = (goal: string) =>
  `Design a test for this goal:\n\n${goal.slice(0, 1000)}`;

/* ---------------- 2. summarize open answers ---------------- */

export interface AnswerSummary {
  summary: string;
  themes: { label: string; count?: number; example?: string }[];
}

export const SUMMARY_SYSTEM = [
  "You summarize open-ended answers from a usability test. Be faithful to what people actually said — do not invent sentiment or themes that aren't there.",
  "Return a 1–2 sentence overall `summary`, then 2–5 `themes`, each with a short `label`, an approximate `count` of how many answers touch it, and one representative `example` quote taken verbatim from the answers.",
  "If there are too few answers to find themes, say so in `summary` and return an empty `themes` array.",
  'Return JSON: {"summary": string, "themes": [{"label": string, "count": number, "example": string}]}',
].join("\n");

export const summaryUserMessage = (prompt: string, verbatims: string[]) =>
  `Question: ${prompt}\n\nAnswers (${verbatims.length}):\n${verbatims.map((v, i) => `${i + 1}. ${v}`).join("\n")}`;

/** Minimum answers before offering a summary — fewer than this, just read them. */
export const SUMMARY_MIN_ANSWERS = 4;
