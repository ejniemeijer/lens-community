"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useApp } from "@/lib/store";

/** Compact theme control cycling light → dark → system. Used by the app
    topbar and the standalone admin console headers. */
export function ThemeButton() {
  const theme = useApp((s) => s.theme);
  const resolvedTheme = useApp((s) => s.resolvedTheme);
  const cycleTheme = useApp((s) => s.cycleTheme);
  return (
    <button
      onClick={cycleTheme}
      className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
      aria-label="Change theme"
      title={
        theme === "system"
          ? `Theme: System (${resolvedTheme})`
          : theme === "dark"
            ? "Theme: Dark"
            : "Theme: Light"
      }
    >
      {theme === "system" ? (
        <Monitor className="h-[18px] w-[18px]" />
      ) : theme === "dark" ? (
        <Moon className="h-[18px] w-[18px]" />
      ) : (
        <Sun className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
