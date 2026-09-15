import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {hrefLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}
