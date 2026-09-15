import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-xs", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card that behaves as a link with hover elevation. */
export function LinkCard({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg border border-border bg-surface shadow-xs transition-all duration-100",
        "hover:border-border-strong hover:shadow-md focus-visible:border-primary",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}
