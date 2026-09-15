"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, LayoutDashboard } from "lucide-react";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Segmented } from "@/components/ui/segmented";
import { useTabParam } from "@/components/ui/tabs";
import { ResearchDashboard } from "@/components/dashboards/research-dashboard";
import { ProductDashboard } from "@/components/dashboards/product-dashboard";
import { LeadershipDashboard } from "@/components/dashboards/leadership-dashboard";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";

type View = "research" | "product" | "leadership";

const DESCRIPTIONS: Record<View, string> = {
  research: "Your live view of studies, participants, and the freshest insights.",
  product: "What research is telling you to build — opportunities, requests, and coverage.",
  leadership: "The strategic picture: coverage, evidence, and the biggest customer challenges.",
};

/** Time-of-day greeting from the viewer's local clock (SSR-safe: resolves after mount). */
function useGreeting() {
  const [hour, setHour] = React.useState<number | null>(null);
  React.useEffect(() => {
    const update = () => setHour(new Date().getHours());
    update();
    const timer = setInterval(update, 60_000); // stays correct if the tab is left open
    return () => clearInterval(timer);
  }, []);
  if (hour === null) return "Welcome";
  if (hour < 5) return "Good evening"; // night owls
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  useDb();
  const [view, setView] = useTabParam("view", "research") as [View, (v: View) => void];
  const user = currentUser();
  const role = useApp((s) => s.role);
  const greeting = useGreeting();

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={LayoutDashboard} />}
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={DESCRIPTIONS[view]}
        actions={
          can(role, "use-ai") && user.aiEnabled !== false ? (
            <Link href="/ai">
              <Button variant="secondary" size="sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Ask AI
              </Button>
            </Link>
          ) : undefined
        }
      >
        <div className="pb-4">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "research", label: "Research" },
              { value: "product", label: "Product" },
              { value: "leadership", label: "Leadership" },
            ]}
          />
        </div>
      </PageHeader>
      <PageBody>
        {view === "research" && <ResearchDashboard />}
        {view === "product" && <ProductDashboard />}
        {view === "leadership" && <LeadershipDashboard />}
      </PageBody>
    </>
  );
}
