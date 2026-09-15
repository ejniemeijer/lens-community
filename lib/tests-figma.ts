/**
 * Figma prototype embedding — pure helpers, no runtime imports, so they're
 * unit-testable and safe to call from the participant runner.
 *
 * The participant runner never iframes a URL a researcher typed: it runs the
 * pasted link through `figmaEmbedUrl`, which only ever returns an
 * embed.figma.com URL built from a parsed file key. Anything else yields null
 * and the runner degrades to "open in a new tab".
 *
 * Only the embed itself works for anonymous participants — Figma's Embed API
 * (screen-change/click events) requires the viewer to be logged into Figma, so
 * this block measures outcome + answers, not click paths. See
 * docs/unmoderated-testing.md.
 */

import type { FigmaProtoBlock } from "@/lib/types";

type FigmaFrame = NonNullable<FigmaProtoBlock["frame"]>;

const FIGMA_HOSTS = new Set(["figma.com", "www.figma.com", "embed.figma.com"]);
/** Prototype-capable path segments. `board` (FigJam) is deliberately absent. */
const FIGMA_KINDS = new Set(["proto", "design", "file"]);

export interface FigmaProtoRef {
  fileKey: string;
  /** The human-readable name segment; kept only so the embed URL looks normal. */
  slug?: string;
  nodeId?: string;
  startingPointNodeId?: string;
}

/** Pull the src out of a pasted `<iframe …>` snippet (Figma's Share → Embed
    hands people the whole tag, so accept it rather than reject it). */
function unwrapIframe(raw: string): string {
  const m = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(raw);
  return m ? m[1] : raw;
}

export function parseFigmaUrl(raw: string): FigmaProtoRef | null {
  const input = unwrapIframe((raw ?? "").trim());
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !FIGMA_HOSTS.has(u.hostname.toLowerCase())) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || !FIGMA_KINDS.has(parts[0].toLowerCase())) return null;
  const fileKey = parts[1];
  // File keys are alphanumeric; anything else means we misread the URL.
  if (!/^[A-Za-z0-9]{10,64}$/.test(fileKey)) return null;
  const ref: FigmaProtoRef = { fileKey };
  const slug = parts[2];
  if (slug) ref.slug = slug;
  const nodeId = u.searchParams.get("node-id");
  if (nodeId) ref.nodeId = nodeId;
  // Figma links carry the flow's entry frame; without it the prototype opens on
  // whatever frame happens to be first, which is rarely the task's start.
  const start = u.searchParams.get("starting-point-node-id");
  if (start) ref.startingPointNodeId = start;
  else if (nodeId) ref.startingPointNodeId = nodeId;
  return ref;
}

export const isFigmaProtoUrl = (raw: string) => parseFigmaUrl(raw) !== null;

/**
 * The iframe URL for a pasted prototype link, or null if it isn't a Figma URL.
 * Every embed option is fixed rather than exposed to the researcher: each one
 * is a measurement decision with a right answer, not a preference.
 * `scaling=contain` fits the frame inside our stage so nothing scrolls or clips.
 */
export function figmaEmbedUrl(raw: string): string | null {
  const ref = parseFigmaUrl(raw);
  if (!ref) return null;
  const path = ref.slug ? `${ref.fileKey}/${ref.slug}` : ref.fileKey;
  const u = new URL(`https://embed.figma.com/proto/${path}`);
  u.searchParams.set("embed-host", "lens");
  // Figma's own chrome would make the prototype read as a design tool.
  u.searchParams.set("footer", "false");
  u.searchParams.set("viewport-controls", "false");
  // Undocumented for prototype embeds but honored (verified against a live
  // embed): drops Figma's prev/next/restart overlay. Those arrows let a
  // participant page through screens without touching the design, which is
  // exactly the behavior the task is supposed to measure.
  u.searchParams.set("hide-ui", "1");
  u.searchParams.set("scaling", "contain");
  u.searchParams.set("content-scaling", "fixed");
  // Both default to true at Figma's end, so they have to be sent. Hints show
  // the participant where the prototype is clickable — which is the question,
  // not the answer. The bezel only eats stage space the design could use.
  u.searchParams.set("hotspot-hints", "false");
  u.searchParams.set("device-frame", "false");
  if (ref.nodeId) u.searchParams.set("node-id", ref.nodeId);
  if (ref.startingPointNodeId) u.searchParams.set("starting-point-node-id", ref.startingPointNodeId);
  return u.toString();
}

/** Aspect ratio of the runner stage per frame preset (w / h). */
export const FIGMA_FRAME_ASPECT: Record<FigmaFrame, number> = {
  phone: 390 / 844,
  tablet: 4 / 3,
  desktop: 16 / 10,
};

export const FIGMA_FRAME_LABELS: Record<FigmaFrame, string> = {
  phone: "Phone",
  tablet: "Tablet",
  desktop: "Desktop",
};
