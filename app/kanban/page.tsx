"use client";

import * as React from "react";
import { Columns3 } from "lucide-react";
import { getProject, insights as allInsights } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { KANBAN_STAGES_PREF, parseStages, isStage } from "@/lib/workflow";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Select } from "@/components/ui/field";
import { KanbanBoard } from "@/components/boards/kanban-board";

export default function KanbanPage() {
  useDb();
  const boards = useApp((s) => s.kanban);
  const stages = parseStages(useApp((s) => s.prefs[KANBAN_STAGES_PREF]));
  const [boardId, setBoardId] = React.useState(boards[0]?.id ?? "");
  const board = boards.find((b) => b.id === boardId) ?? boards[0];

  React.useEffect(() => {
    if (board && board.id !== boardId) setBoardId(board.id);
  }, [board, boardId]);

  if (!board) return null;
  const project = board.projectId ? getProject(board.projectId) : undefined;
  const scoped = board.projectId
    ? allInsights.filter((i) => i.projectIds.includes(board.projectId!))
    : allInsights;
  const onBoard = scoped.filter((i) => isStage(i.workflowStage, stages)).length + (board.cards ?? []).filter((c) => !c.insightId).length;

  return (
    <>
      <PageHeader
        title="Kanban"
        description="A live view of your insights moving through the research-to-product workflow. Drag a card to change its stage."
        actions={
          <Select value={board.id} onChange={(e) => setBoardId(e.target.value)}>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        }
      >
        <div className="flex items-center gap-2 pb-4 text-xs text-subtle">
          <Columns3 className="h-4 w-4" />
          <span>{stages.length} stages · {onBoard} on the board</span>
          {project && <span>· {project.name}</span>}
        </div>
      </PageHeader>
      <PageBody wide>
        <KanbanBoard boardId={board.id} />
      </PageBody>
    </>
  );
}
