"use client";

import * as React from "react";
import { LayoutGrid, List, Table2 } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";

/** The layouts a list page can offer ("table" only where the page renders one). */
export type ListView = "cards" | "list" | "table";

/**
 * Per-page view preference, remembered across visits in localStorage. Pass a
 * stable key per page (e.g. "projects"). Defaults to "cards". "table" is only
 * ever stored by pages that offer it, so restoring it is safe per key.
 */
export function useListView(key: string, initial: ListView = "cards"): [ListView, (v: ListView) => void] {
  const [view, setView] = React.useState<ListView>(initial);
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(`lens-view:${key}`);
      if (v === "cards" || v === "list" || v === "table") setView(v);
    } catch {}
  }, [key]);
  const set = React.useCallback(
    (v: ListView) => {
      setView(v);
      try {
        localStorage.setItem(`lens-view:${key}`, v);
      } catch {}
    },
    [key],
  );
  return [view, set];
}

/** The shared view toggle rendered on every list page. `withTable` prepends a
    Table option for pages that render a sortable table view. */
export function ListViewToggle({
  view,
  onChange,
  withTable,
}: {
  view: ListView;
  onChange: (v: ListView) => void;
  withTable?: boolean;
}) {
  return (
    <Segmented
      value={view}
      onChange={onChange}
      size="sm"
      options={[
        ...(withTable ? [{ value: "table" as const, icon: <Table2 className="h-4 w-4" />, title: "Table" }] : []),
        { value: "cards", icon: <LayoutGrid className="h-4 w-4" />, title: "Cards" },
        { value: "list", icon: <List className="h-4 w-4" />, title: "List" },
      ]}
    />
  );
}
