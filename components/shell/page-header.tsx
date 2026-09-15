import * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/** The standard page-header icon: a soft, primary-tinted rounded square around
    the page's topic icon. Pass the same Lucide icon the sidebar nav uses. */
export function PageIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  icon,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border bg-canvas", className)}>
      <div className="px-5 pt-5 sm:px-7">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-xs text-subtle">
            {breadcrumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-muted">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
              {/* A div, not a <p>: some pages put an interactive control in the
                  description (the test page's project picker), and a block-level
                  child inside a <p> breaks out of it during HTML parsing, which
                  then mismatches on hydration. */}
              {description && (
                <div className="mt-1 max-w-2xl text-sm text-muted">{description}</div>
              )}
            </div>
          </div>
          {/* On mobile the actions drop below the title and wrap across lines
              instead of overflowing off-screen; inline on sm+. */}
          {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Standard page content wrapper with padding + max width. */
export function PageBody({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("px-5 py-6 sm:px-7", wide ? "" : "mx-auto max-w-[1400px]", className)}>
      {children}
    </div>
  );
}
