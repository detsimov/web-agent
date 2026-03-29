"use client";

import { useCallback, useState } from "react";

export type BranchTab = {
  id: number;
  name: string;
  parentBranchId: number | null;
};

type Props = {
  branches: BranchTab[];
  activeBranchId: number;
  onSwitchBranch: (branchId: number) => void;
  onCreateFork: () => void;
  onDeleteBranch: (branchId: number) => void;
  onRenameBranch: (branchId: number, name: string) => void;
};

export function BranchTabs({
  branches,
  activeBranchId,
  onSwitchBranch,
  onCreateFork,
  onDeleteBranch,
  onRenameBranch,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDoubleClick = useCallback((branch: BranchTab) => {
    if (!branch.parentBranchId) return; // Can't rename main
    setEditingId(branch.id);
    setEditValue(branch.name);
  }, []);

  const handleRenameSubmit = useCallback(
    (branchId: number) => {
      const trimmed = editValue.trim();
      if (trimmed) {
        onRenameBranch(branchId, trimmed);
      }
      setEditingId(null);
    },
    [editValue, onRenameBranch],
  );

  return (
    <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/50">
      {branches.map((branch) => {
        const isActive = branch.id === activeBranchId;
        const isMain = !branch.parentBranchId;

        if (editingId === branch.id) {
          return (
            <input
              key={branch.id}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleRenameSubmit(branch.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit(branch.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              // biome-ignore lint/a11y/noAutofocus: renaming requires focus
              autoFocus
              className="rounded border border-zinc-400 bg-white px-2 py-0.5 text-xs outline-none dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
            />
          );
        }

        return (
          <div key={branch.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSwitchBranch(branch.id)}
              onDoubleClick={() => handleDoubleClick(branch)}
              className={`rounded-t px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              title={isMain ? undefined : "Double-click to rename"}
            >
              {isMain && (
                <span
                  className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-zinc-400"}`}
                />
              )}
              {branch.name}
            </button>
            {!isMain && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBranch(branch.id);
                }}
                className="ml-0.5 rounded p-0.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                aria-label={`Delete branch ${branch.name}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreateFork}
        className="rounded px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        title="Fork from last main message"
      >
        +
      </button>
    </div>
  );
}
