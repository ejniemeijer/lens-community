import * as React from "react";

/** Renders inline **bold** within a line as React nodes (no HTML injection). */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>
    ),
  );
}

/**
 * Minimal, safe renderer for the light markdown the model returns:
 * paragraphs, `-`/`*` bullets, `#`/`##` headings, and **bold**. No raw HTML.
 */
export function AiProse({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    const items = [...list];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 flex list-disc flex-col gap-1 pl-5">
        {items.map((it, i) => (
          <li key={i} className="text-[14px] leading-relaxed text-muted">{inline(it, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <h4 key={`h-${idx}`} className="mt-3 text-sm font-semibold text-foreground first:mt-0">
          {inline(heading[2], `h-${idx}`)}
        </h4>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} className="my-1.5 text-[14px] leading-relaxed text-muted first:mt-0">
        {inline(trimmed, `p-${idx}`)}
      </p>,
    );
  });
  flushList();

  return <div className={className}>{blocks}</div>;
}
