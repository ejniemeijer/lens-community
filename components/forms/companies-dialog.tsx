"use client";

import * as React from "react";
import { Building2, Check, Merge, Pencil, Search, Trash2, X } from "lucide-react";
import { companies, participants } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";

/**
 * Company maintenance.
 *
 * Companies are created as a side effect of adding a participant (type a name
 * that doesn't exist and one appears), so the library accumulates typos,
 * near-duplicates ("Amphia" vs "Amphia Ziekenhuis" don't match), and orphans —
 * changing a participant's company leaves the old one behind with nobody in
 * it. Nothing else in the app could rename an orphan, delete anything, or
 * combine two records for the same company.
 *
 * Reached from the Participants page rather than the sidebar on purpose:
 * companies are participant infrastructure, not a library you curate, and a
 * nav slot beside Personas/Themes/Tags would overstate how often this is used.
 *
 * Deleting is only offered once a company is empty — Participant.companyId is
 * required, so removing one still in use would leave dangling references.
 * Merge is how you empty it.
 */
export function CompaniesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDb();
  const updateCompany = useApp((s) => s.updateCompany);
  const deleteCompany = useApp((s) => s.deleteCompany);
  const mergeCompanies = useApp((s) => s.mergeCompanies);
  const toast = useApp((s) => s.toast);

  const [query, setQuery] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [mergingId, setMergingId] = React.useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = React.useState("all");

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setEditingId(null);
    setMergingId(null);
  }, [open]);

  const countFor = (id: string) => participants.filter((p) => p.companyId === id).length;
  const rows = [...companies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const unused = companies.filter((c) => countFor(c.id) === 0);

  const saveName = (id: string) => {
    const name = draft.trim();
    if (!name) return setEditingId(null);
    const clash = companies.find((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      // Renaming onto an existing name is really a merge — say so rather than
      // silently creating the duplicate this dialog exists to clean up.
      toast(`“${clash.name}” already exists — use merge to combine them.`, "error");
      return;
    }
    updateCompany(id, { name });
    setEditingId(null);
    toast("Company renamed");
  };

  const runMerge = (sourceId: string) => {
    if (mergeTarget === "all") return;
    const source = companies.find((c) => c.id === sourceId);
    const target = companies.find((c) => c.id === mergeTarget);
    const moved = countFor(sourceId);
    if (mergeCompanies(sourceId, mergeTarget)) {
      toast(
        moved > 0
          ? `Moved ${moved} participant${moved === 1 ? "" : "s"} to “${target?.name}” and removed “${source?.name}”`
          : `Removed “${source?.name}”`,
      );
    }
    setMergingId(null);
    setMergeTarget("all");
  };

  const removeUnused = () => {
    const n = unused.length;
    unused.forEach((c) => deleteCompany(c.id));
    toast(`Removed ${n} unused compan${n === 1 ? "y" : "ies"}`, "info");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage companies"
      description="Companies are created when you type a new name while adding a participant. Rename them, merge duplicates, or clear out ones nobody is linked to."
      className="max-w-2xl"
      footer={<Button variant="ghost" onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="pl-8"
            />
          </div>
          <span className="text-xs text-subtle">
            {companies.length} compan{companies.length === 1 ? "y" : "ies"}
          </span>
          {unused.length > 0 && (
            <Button variant="outline" size="sm" onClick={removeUnused}>
              <Trash2 className="h-4 w-4" /> Remove {unused.length} unused
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">
            {companies.length === 0 ? "No companies yet." : "No companies match that search."}
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
            {rows.map((c) => {
              const n = countFor(c.id);
              const editing = editingId === c.id;
              const merging = mergingId === c.id;
              return (
                <div key={c.id} className="border-b border-border p-2.5 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`accent-${c.logoAccent ?? "slate"} flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]`}
                      aria-hidden
                    >
                      <Building2 className="h-4 w-4" />
                    </span>

                    {editing ? (
                      <>
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveName(c.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="min-w-0 flex-1"
                        />
                        <Button variant="primary" size="sm" onClick={() => saveName(c.id)}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">{c.name}</p>
                          <p className="truncate text-xs text-subtle">
                            {[c.industry, c.country, c.size ?? "size unknown"].filter((x) => x && x !== "—").join(" · ") || "No details"}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs ${n === 0 ? "text-subtle" : "text-muted"}`}>
                          {n === 0 ? "unused" : `${n} participant${n === 1 ? "" : "s"}`}
                        </span>
                        <button
                          onClick={() => { setEditingId(c.id); setDraft(c.name); setMergingId(null); }}
                          className="shrink-0 rounded p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
                          aria-label={`Rename ${c.name}`}
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setMergingId(merging ? null : c.id); setMergeTarget("all"); setEditingId(null); }}
                          disabled={companies.length < 2}
                          className="shrink-0 rounded p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                          aria-label={`Merge ${c.name} into another company`}
                          title={companies.length < 2 ? "Nothing to merge into" : "Merge into another company"}
                        >
                          <Merge className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (deleteCompany(c.id)) toast(`Removed “${c.name}”`, "info");
                          }}
                          disabled={n > 0}
                          className="shrink-0 rounded p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-danger disabled:opacity-30 disabled:hover:text-subtle"
                          aria-label={`Delete ${c.name}`}
                          title={n > 0 ? `${n} participant${n === 1 ? " is" : "s are"} linked — merge it instead` : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {merging && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 p-2.5">
                      <span className="text-xs text-muted">
                        {n > 0
                          ? `Move ${n} participant${n === 1 ? "" : "s"} to:`
                          : "Remove this and keep:"}
                      </span>
                      <SearchableSelect
                        value={mergeTarget}
                        onChange={setMergeTarget}
                        allLabel="Pick a company…"
                        placeholder="Search companies…"
                        options={companies.filter((o) => o.id !== c.id).map((o) => ({ value: o.id, label: o.name }))}
                        className="min-w-[12rem]"
                      />
                      <Button variant="primary" size="sm" disabled={mergeTarget === "all"} onClick={() => runMerge(c.id)}>
                        <Check className="h-4 w-4" /> Merge
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setMergingId(null)}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
