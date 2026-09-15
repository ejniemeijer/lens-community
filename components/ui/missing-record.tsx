"use client";

import { notFound } from "next/navigation";

/**
 * Client detail pages can't resolve user-created records during SSR
 * (they live in localStorage). While the store hydrates, show a quiet
 * placeholder; once hydrated, a genuinely missing id is a real 404.
 */
export function MissingRecord({ hydrated }: { hydrated: boolean }) {
  if (hydrated) notFound();
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
