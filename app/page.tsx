"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Telescope } from "lucide-react";

/** Community-edition entry point: no marketing surface — go straight to the app. */
export default function Home() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
        <Telescope className="h-5 w-5 animate-pulse" />
      </span>
    </div>
  );
}
