import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Marlon Verhoef" -> "MV" */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic accent name for a string — stable across renders/reloads. */
const ACCENTS = [
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
  "orange",
  "amber",
  "lime",
  "green",
  "teal",
  "cyan",
  "slate",
] as const;
export type AccentName = (typeof ACCENTS)[number];

export function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function accentFor(seed: string): AccentName {
  return ACCENTS[hashString(seed) % ACCENTS.length];
}

/** Pluralize a noun by count: count(3, "insight") -> "3 insights" */
export function count(n: number, singular: string, plural?: string) {
  const word = n === 1 ? singular : plural ?? `${singular}s`;
  return `${n.toLocaleString()} ${word}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "2026-06-14" -> "Jun 14, 2026" */
export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

function relativeFrom(iso: string, nowMs: number) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const diff = d.getTime() - nowMs;
  const days = Math.round(diff / 86_400_000);
  const abs = Math.abs(days);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 1) return "today";
  if (abs < 7) return rtf.format(days, "day");
  if (abs < 31) return rtf.format(Math.round(days / 7), "week");
  if (abs < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

/** Relative time vs. the app's pinned demo "today" (2026-07-03) — keeps the
    seeded demo dataset feeling fresh no matter when it's viewed. Use ONLY for
    seeded/demo content; real timestamps belong to relativeToNow. */
const TODAY = new Date("2026-07-03T12:00:00");
export function relativeTime(iso: string) {
  return relativeFrom(iso, TODAY.getTime());
}

/** Relative time vs. the actual clock — for real timestamps (sign-ins,
    account creation, access requests) that must not shift with the demo date. */
export function relativeToNow(iso: string) {
  return relativeFrom(iso, Date.now());
}

/** Seconds -> "12:04" */
export function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function uid(prefix = "id") {
  // Deterministic-enough unique id for client-created records.
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Glob-ish path match: "*" is the only wildcard, anchored at the start.
    Used for test success patterns and route-screenshot mapping. */
export function globMatch(path: string, pattern?: string): boolean {
  if (!pattern) return false;
  const re = new RegExp(
    "^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*"),
  );
  return re.test(path);
}

/** Cryptographically random URL-safe token (unguessable — unlike uid, which
    is only collision-safe). Used for public share links. */
export function randomToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The participant link for a test. Absolute in the browser; root-relative
 * during SSR, which still reads as a link instead of rendering an empty string
 * that then changes on hydration.
 */
export function testShareUrl(shareToken: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/t/${shareToken}`;
}

/** Group an array by a key selector. */
export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}
