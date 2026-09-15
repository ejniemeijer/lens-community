"use client";

import * as React from "react";
import { Network } from "lucide-react";
import { getProject } from "@/lib/db";
import { useApp } from "@/lib/store";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Select } from "@/components/ui/field";
import { AffinityBoard } from "@/components/boards/affinity-board";

export default function AffinityPage() {
  const boards = useApp((s) => s.affinity);
  const [boardId, setBoardId] = React.useState(boards[0]?.id ?? "");
  const board = boards.find((b) => b.id === boardId) ?? boards[0];

  React.useEffect(() => {
    if (board && board.id !== boardId) setBoardId(board.id);
  }, [board, boardId]);

  if (!board) return null;
  const project = board.projectId ? getProject(board.projectId) : undefined;

  return (
    <>
      <PageHeader
        title="Affinity Map"
        description="Cluster observations into themes. Drag notes between clusters, rename, recolor, and merge."
        actions={
          <Select value={board.id} onChange={(e) => setBoardId(e.target.value)}>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        }
      >
        <div className="flex items-center gap-2 pb-4 text-xs text-subtle">
          <Network className="h-4 w-4" />
          <span>{board.groups.length} clusters · {board.notes.length} notes</span>
          {project && <span>· {project.name}</span>}
        </div>
      </PageHeader>
      <PageBody wide>
        <AffinityBoard boardId={board.id} />
      </PageBody>
    </>
  );
}
