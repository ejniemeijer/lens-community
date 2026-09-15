import Link from "next/link";
import { Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Telescope className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-semibold text-foreground">Nothing to see here</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        We couldn&apos;t find that page. It may have been moved, or the link is out of date.
      </p>
      <Link href="/dashboard" className="mt-5">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
