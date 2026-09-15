"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft, Telescope, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { navGroupsFor, settingsItem, type NavItem } from "./nav-config";

function isActive(item: NavItem, path: string) {
  return item.match ? item.match(path) : path === item.href;
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const active = isActive(item, path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-surface text-foreground shadow-xs"
          : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const role = useApp((s) => s.role);
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 no-scrollbar">
      {navGroupsFor(role).map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-2.5 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">
              {group.title}
            </p>
          )}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
      <div className="mt-auto pt-2">
        <NavLink item={settingsItem} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-sm">
        <Telescope className="h-[18px] w-[18px]" />
      </span>
      {!collapsed && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Lens</span>
          <span className="text-[10px] text-subtle">Research Repository</span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const toggle = useApp((s) => s.toggleSidebar);

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-canvas md:flex",
          "transition-[width] duration-200",
          collapsed ? "w-[64px]" : "w-[248px]",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-border px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button
              onClick={toggle}
              className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-foreground"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggle}
            className="mx-auto mt-2 rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-foreground"
            title="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 animate-fade-in bg-[hsl(224_40%_8%/0.5)]" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 flex h-full w-[264px] animate-slide-in-right flex-col border-r border-border bg-canvas">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <Brand collapsed={false} />
              <button
                onClick={onCloseMobile}
                className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
