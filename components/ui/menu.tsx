"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MenuContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const MenuCtx = React.createContext<MenuContextValue | null>(null);

export function Menu({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <MenuCtx.Provider value={{ open, setOpen }}>
      <div ref={ref} className={cn("relative", className)}>
        {children}
      </div>
    </MenuCtx.Provider>
  );
}

export function MenuTrigger({ children }: { children: React.ReactElement }) {
  const ctx = React.useContext(MenuCtx)!;
  return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
    onClick: () => ctx.setOpen(!ctx.open),
  });
}

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const ctx = React.useContext(MenuCtx)!;
  if (!ctx.open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-1.5 min-w-[200px] animate-scale-in overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-popover",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  active,
  destructive,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  icon?: React.ReactNode;
  active?: boolean;
  destructive?: boolean;
}) {
  const ctx = React.useContext(MenuCtx)!;
  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        ctx.setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
        destructive
          ? "text-danger hover:bg-danger-soft"
          : "text-foreground hover:bg-surface-hover",
        active && "bg-surface-hover",
      )}
    >
      {icon && <span className="text-muted">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
