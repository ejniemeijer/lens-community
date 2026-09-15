"use client";

import * as React from "react";
import { Building2, MoreHorizontal, Plus, Search, Users, ListChecks } from "lucide-react";
import { participants, personas, companies, fullName } from "@/lib/db";
import type { RecruitmentStatus } from "@/lib/types";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ParticipantViews,
  participantSortValue,
  PARTICIPANT_DESC_FIRST,
  type ParticipantSortKey,
} from "@/components/participants/participant-views";
import { ParticipantFormModal } from "@/components/forms/participant-form";
import { ImportDialog } from "@/components/forms/import-dialog";
import { CompaniesDialog } from "@/components/forms/companies-dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useBulkSelect, BulkBar } from "@/components/ui/bulk-select";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { useSortState, sortRows } from "@/components/ui/sort-table";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";

export default function ParticipantsPage() {
  const version = useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const deleteParticipant = useApp((s) => s.deleteParticipant);
  const toast = useApp((s) => s.toast);
  const sel = useBulkSelect();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [view, setView] = useListView("participants", "table");
  const [query, setQuery] = React.useState("");
  const [persona, setPersona] = React.useState("all");
  const [company, setCompany] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [showNew, setShowNew] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [showCompanies, setShowCompanies] = React.useState(false);
  const [sort, toggleSort] = useSortState<ParticipantSortKey>({ key: "name", dir: 1 }, PARTICIPANT_DESC_FIRST);

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("persona");
    const c = sp.get("company");
    if (p) setPersona(p);
    if (c) setCompany(c);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (persona !== "all" && !p.personaIds.includes(persona)) return false;
      if (company !== "all" && p.companyId !== company) return false;
      if (status !== "all" && p.recruitmentStatus !== status) return false;
      if (q) {
        const hay = `${fullName(p)} ${p.jobTitle} ${p.department} ${p.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, persona, company, status, version]);

  // Sort applies to every view, so switching table ↔ cards keeps the order.
  const sorted = React.useMemo(() => sortRows(filtered, sort, participantSortValue), [filtered, sort]);

  const filteredIds = filtered.map((p) => p.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => sel.isSelected(id));
  const runDelete = () => {
    const n = sel.count;
    sel.selected.forEach((id) => deleteParticipant(id));
    sel.stop();
    toast(`Deleted ${n} participant${n === 1 ? "" : "s"}`, "info");
  };

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={Users} />}
        title="Participants"
        description="A reusable database of everyone you research with — searchable, tagged, and consent-aware."
        actions={
          canManage ? (
            sel.selecting ? (
              <Button variant="outline" size="sm" onClick={sel.stop}>Cancel</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={sel.start}>
                  <ListChecks className="h-4 w-4" /> Select
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>Import</Button>
                <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4" /> New participant
                </Button>
                {/* Occasional maintenance, so it lives behind the overflow
                    rather than competing with the primary actions. */}
                <Menu>
                  <MenuTrigger>
                    <Button variant="ghost" size="icon" aria-label="More participant actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Building2 className="h-4 w-4" />} onSelect={() => setShowCompanies(true)}>
                      Manage companies
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </>
            )
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search participants…"
              className="pl-8"
            />
          </div>
          <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="all">All personas</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <SearchableSelect
            value={company}
            onChange={setCompany}
            allLabel="All companies"
            placeholder="Search companies…"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>
            {(["available", "contacted", "scheduled", "interviewed", "do-not-contact"] as RecruitmentStatus[]).map((s) => (
              <option key={s} value={s}>{s.replace(/-/g, " ")}</option>
            ))}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-subtle">{filtered.length} of {participants.length}</span>
            <ListViewToggle view={view} onChange={setView} withTable />
          </div>
        </div>
      </PageHeader>

      <PageBody wide>
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No participants match" description="Try clearing a filter or adjusting your search." />
        ) : (
          <ParticipantViews rows={sorted} view={view} sort={sort} onSort={toggleSort} sel={sel} />
        )}
      </PageBody>

      <BulkBar
        count={sel.count}
        noun="participant"
        allSelected={allSelected}
        onToggleAll={() => (allSelected ? sel.clear() : sel.selectOnly(filteredIds))}
        onClear={sel.clear}
        onCancel={sel.stop}
        onDelete={() => setConfirmDelete(true)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={runDelete}
        danger
        title={`Delete ${sel.count} participant${sel.count === 1 ? "" : "s"}?`}
        confirmLabel="Delete"
        body={
          <>
            This permanently removes the selected participant{sel.count === 1 ? "" : "s"} and their
            interviews, and detaches them from projects, insights, and boards. This can&apos;t be undone.
          </>
        }
      />

      <ParticipantFormModal open={showNew} onClose={() => setShowNew(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <CompaniesDialog open={showCompanies} onClose={() => setShowCompanies(false)} />
    </>
  );
}
