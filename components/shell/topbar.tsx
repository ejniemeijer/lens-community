"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu as MenuIcon, Search, Sun, Moon, Monitor, LogOut, Settings } from "lucide-react";
import { useApp, useDb } from "@/lib/store";
import { currentUser } from "@/lib/db";
import { TopbarSearch } from "./topbar-search";
import { ThemeButton } from "./theme-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "Auto", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

function SyncPill() {
  const backend = useApp((s) => s.backend);
  const syncState = useApp((s) => s.syncState);
  const syncError = useApp((s) => s.syncError);
  if (backend !== "cloud") return null;
  const meta = {
    idle: { label: "Cloud", cls: "text-subtle", dot: "bg-subtle" },
    syncing: { label: "Saving…", cls: "text-muted", dot: "bg-warning animate-pulse" },
    saved: { label: "Saved", cls: "text-success", dot: "bg-success" },
    error: { label: "Sync error", cls: "text-danger", dot: "bg-danger" },
  }[syncState];
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-2xs font-medium sm:inline-flex"
      title={
        syncState === "error"
          ? `Changes couldn't sync to the cloud${syncError ? `:\n${syncError}` : "."}`
          : "Synced with Supabase"
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <span className={meta.cls}>{meta.label}</span>
    </span>
  );
}

function DemoPill() {
  const demo = useApp((s) => s.demo);
  if (!demo) return null;
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-2xs font-medium sm:inline-flex"
      title="Demo sandbox — sample data. Changes stay in this tab and are discarded when it closes."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      <span className="text-warning">Demo mode</span>
    </span>
  );
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  useDb();
  const router = useRouter();
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const signOut = useApp((s) => s.signOut);
  const demo = useApp((s) => s.demo);
  const user = currentUser();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur">
      {/* Left */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground md:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Center — global search (Teams-style anchored popup) */}
      <div className="hidden flex-[2] justify-center sm:flex">
        <TopbarSearch />
      </div>
      <button
        onClick={() => router.push("/search")}
        className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground sm:hidden"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Right */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <DemoPill />
        <SyncPill />
        <ThemeButton />

        <Menu>
          <MenuTrigger>
            <button className="rounded-full ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-border-strong">
              <Avatar name={user.name} accent={user.avatarColor} size="sm" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar name={user.name} accent={user.avatarColor} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
                <Badge tone="primary" className="mt-1">{ROLE_LABELS[user.role]}</Badge>
              </div>
            </div>
            <MenuSeparator />
            <Link href="/settings">
              <MenuItem icon={<Settings className="h-4 w-4" />}>Settings</MenuItem>
            </Link>
            <MenuLabel>Theme</MenuLabel>
            <div className="px-2 pb-1.5">
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
                {THEME_OPTIONS.map((o) => {
                  const active = theme === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => setTheme(o.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <o.Icon className="h-3.5 w-3.5" /> {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <MenuSeparator />
            <MenuItem icon={<LogOut className="h-4 w-4" />} destructive onSelect={signOut}>
              {demo ? "Exit demo" : "Sign out"}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
