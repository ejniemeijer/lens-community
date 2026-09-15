import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Keyboard hint. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Thin progress meter. */
export function Meter({
  value,
  accent = "primary",
  className,
}: {
  value: number; // 0..1
  accent?: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const isAccent = accent !== "primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full", isAccent ? `accent-${accent}` : "")}
        style={{
          width: `${pct}%`,
          backgroundColor: isAccent ? "hsl(var(--a-solid))" : "hsl(var(--primary))",
        }}
      />
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

/** Definition row for detail pages. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(96px,140px)_minmax(0,1fr)] gap-3 py-2 text-sm", className)}>
      <dt className="min-w-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Small stat tile. Pass `accent` (a token name like "blue"/"violet") to show
    the icon in a soft colored chip and tint the left edge. */
export function Stat({
  label,
  value,
  hint,
  icon,
  accent,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon &&
          (accent ? (
            <span className={cn(`accent-${accent}`, "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]")}>
              {icon}
            </span>
          ) : (
            <span className="text-subtle">{icon}</span>
          ))}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </>
  );
  const cls = cn(
    "rounded-lg border border-border bg-surface p-4 shadow-xs",
    accent && `accent-${accent} border-l-2 border-l-[hsl(var(--a-solid))]`,
    href && "transition-all hover:border-border-strong hover:shadow-md",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
