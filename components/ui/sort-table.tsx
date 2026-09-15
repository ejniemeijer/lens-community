"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared column-sorting primitives for the table views (participants,
 * insights, interviews). Each page supplies its own key union and a
 * value extractor; these handle the state, the comparator, and the
 * clickable header cell.
 */

export type SortDir = 1 | -1;
export type SortState<K extends string> = { key: K; dir: SortDir };

/** Sort state + toggle: first click activates a column (desc-first for the
    listed keys — counts/dates where "most/newest first" is expected); a
    second click flips the direction. The third element sets the state
    directly, for pages whose filters imply an order (e.g. "scheduled" →
    soonest first). */
export function useSortState<K extends string>(
  initial: SortState<K>,
  descFirst: readonly K[] = [],
): [SortState<K>, (key: K) => void, (s: SortState<K>) => void] {
  const [sort, setSort] = React.useState<SortState<K>>(initial);
  const toggle = React.useCallback(
    (key: K) =>
      setSort((s) =>
        s.key === key ? { key, dir: -s.dir as SortDir } : { key, dir: descFirst.includes(key) ? -1 : 1 },
      ),
    [descFirst],
  );
  return [sort, toggle, setSort];
}

/** Stable sort of rows by the extractor's value for the active column. */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  value: (row: T, key: K) => string | number,
): T[] {
  const arr = [...rows];
  arr.sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return 0;
  });
  return arr;
}

/** Clickable column header: click to sort, click again to flip direction. */
export function SortTh<K extends string>({
  label,
  k,
  sort,
  onSort,
  center,
}: {
  label: string;
  k: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  center?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      className={cn("px-4 py-2.5 font-semibold", center && "text-center")}
    >
      <button
        onClick={() => onSort(k)}
        className={cn(
          "group/th inline-flex items-center gap-1 uppercase tracking-wide transition-colors",
          active ? "text-foreground" : "hover:text-foreground",
        )}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {active ? (
          sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/th:opacity-60" />
        )}
      </button>
    </th>
  );
}

/** Sorts blanks to the end when ascending (U+FFFF compares after any text). */
export const BLANK_LAST = "￿";
