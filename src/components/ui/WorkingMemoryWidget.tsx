"use client";

import { useCallback, useState } from "react";
import type { WorkingMemoryData } from "@/hooks/useChat";

type Props = {
  workingMemory: WorkingMemoryData | null;
  branchId: number | null;
  onUpdate: (data: WorkingMemoryData) => void;
};

export function WorkingMemoryWidget({
  workingMemory,
  branchId,
  onUpdate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEdit = useCallback(() => {
    if (!workingMemory) return;
    setEditValue(JSON.stringify(workingMemory, null, 2));
    setEditing(true);
  }, [workingMemory]);

  const handleSave = useCallback(async () => {
    try {
      const parsed = JSON.parse(editValue);
      if (branchId) {
        await fetch(`/api/branches/${branchId}/working-memory`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: editValue,
        });
      }
      onUpdate(parsed);
      setEditing(false);
    } catch {
      // Invalid JSON, don't save
    }
  }, [editValue, branchId, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  if (!workingMemory || !workingMemory.summary) return null;

  if (editing) {
    return (
      <div className="mx-4 mb-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Working Memory
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded px-2 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-48 w-full rounded border border-zinc-300 bg-white p-2 font-mono text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {workingMemory.steps.length > 0
            ? `${workingMemory.steps.filter((s) => s.status === "done").length}/${workingMemory.steps.length}`
            : null}
        </span>
        <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
          {workingMemory.summary}
        </span>
      </div>
      <button
        type="button"
        onClick={handleEdit}
        className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      >
        Edit
      </button>
    </div>
  );
}
