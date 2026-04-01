"use client";

import { useCallback, useState } from "react";
import type { MachineStateData } from "@/hooks/useChat";

type Props = {
  machineState: MachineStateData | null;
  branchId: number | null;
  onStopped: () => void;
};

const STATE_META: Record<string, { label: string; icon: string }> = {
  planning: {
    label: "Planning",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  execution: { label: "Executing", icon: "M13 10V3L4 14h7v7l9-11h-7" },
  validation: {
    label: "Validating",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  done: { label: "Done", icon: "M5 13l4 4L19 7" },
};

const ALL_STATES = ["planning", "execution", "validation", "done"];

export function MachineStateWidget({
  machineState,
  branchId,
  onStopped,
}: Props) {
  const [stopping, setStopping] = useState(false);

  const handleStop = useCallback(async () => {
    if (!branchId || stopping) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/branches/${branchId}/machine/stop`, {
        method: "POST",
      });
      if (res.ok) {
        onStopped();
      }
    } finally {
      setStopping(false);
    }
  }, [branchId, stopping, onStopped]);

  if (!machineState) return null;

  const currentIndex = ALL_STATES.indexOf(machineState.current);
  const isActive = machineState.status === "active";
  const isCompleted = machineState.status === "completed";
  const isStopped = machineState.status === "stopped";

  return (
    <div className="mx-4 mb-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        {/* Stepper */}
        <div className="flex items-center gap-1">
          {ALL_STATES.map((state, i) => {
            const meta = STATE_META[state] ?? { label: state, icon: "" };
            const isCurrent = state === machineState.current;
            const isPast = i < currentIndex || isCompleted;

            return (
              <div key={state} className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className={`h-px w-4 ${
                      isPast
                        ? "bg-emerald-400 dark:bg-emerald-500"
                        : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  />
                )}
                <div
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    isCurrent && isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : isPast
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-zinc-400 dark:text-zinc-500"
                  }`}
                  title={meta.label}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={meta.icon} />
                  </svg>
                  <span className="hidden sm:inline">{meta.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status + Stop button */}
        <div className="flex items-center gap-2">
          {isStopped && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Stopped
            </span>
          )}
          {isCompleted && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Complete
            </span>
          )}
          {isActive && (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopping}
              className="cursor-pointer rounded px-2 py-0.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
              aria-label="Stop machine"
            >
              {stopping ? "Stopping..." : "Stop"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
