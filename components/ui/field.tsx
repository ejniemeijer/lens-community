"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground",
        "placeholder:text-subtle transition-colors",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
      "placeholder:text-subtle transition-colors resize-none",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

interface SelectOpt {
  value: string;
  label: string;
  disabled?: boolean;
}

function optionText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  return "";
}

/** Flatten `<option>` children (through arrays and fragments) into a list. */
function collectOptions(children: React.ReactNode, out: SelectOpt[] = []): SelectOpt[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const p = child.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean };
      const value = p.value != null ? String(p.value) : "";
      out.push({ value, label: optionText(p.children) || value, disabled: !!p.disabled });
    } else {
      collectOptions((child.props as { children?: React.ReactNode }).children, out);
    }
  });
  return out;
}

type PopPlacement = { left: number; width: number; maxH: number; top?: number; bottom?: number };

/**
 * A dropdown that keeps the native `<select>` API (`value`, `onChange`, `<option>`
 * children) but renders a themed popover list — the same behaviour as the
 * searchable company filter, minus the search box. Portaled so it is never
 * clipped inside scrollable modals; flips above the trigger near the viewport edge.
 */
export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = React.useMemo(() => collectOptions(children), [children]);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [place, setPlace] = React.useState<PopPlacement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  const cur = String(value ?? "");
  const current = options.find((o) => o.value === cur) ?? options[0];

  // Measure the trigger and place the popover below it (flipping up near the
  // viewport edge). Called on open and on scroll/resize so it stays glued to
  // the trigger — important inside scrollable modals.
  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    setPlace(
      flipUp
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxH: Math.min(280, spaceAbove - 8) }
        : { left: r.left, width: r.width, top: r.bottom + 4, maxH: Math.min(280, spaceBelow - 8) },
    );
  }, []);

  React.useLayoutEffect(() => {
    if (open) measure();
    else setPlace(null);
  }, [open, measure]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    let raf = 0;
    const reposition = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, measure]);

  const pick = (v: string) => {
    setOpen(false);
    if (v === cur) return;
    onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className={cn("relative inline-grid", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "col-start-1 row-start-1 flex h-9 w-full items-center rounded-md border bg-surface pl-2.5 pr-8 text-left text-sm text-foreground transition-colors",
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-border-strong",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ""}</span>
      </button>
      <ChevronDown className="pointer-events-none col-start-1 row-start-1 mr-2.5 h-3.5 w-3.5 self-center justify-self-end text-subtle" />

      {open && mounted && place &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              left: place.left,
              minWidth: place.width,
              maxHeight: place.maxH,
              top: place.top,
              bottom: place.bottom,
            }}
            className="z-[110] overflow-auto rounded-lg border border-border bg-overlay p-1 shadow-popover"
            role="listbox"
          >
            {options.map((o, i) => {
              const active = o.value === cur;
              return (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={o.disabled}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "bg-surface-hover font-medium text-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-2xs font-semibold uppercase tracking-wide text-subtle", className)}
      {...props}
    />
  );
}
