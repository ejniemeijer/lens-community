"use client";

import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};

const STYLES = {
  success: "text-success",
  info: "text-info",
  error: "text-danger",
};

export function Toaster() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-overlay p-3 shadow-popover animate-slide-up"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STYLES[t.kind])} />
            <p className="flex-1 text-[13px] leading-snug text-foreground">{t.msg}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-subtle hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
