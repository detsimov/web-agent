"use client";

import { useEffect, useRef } from "react";
import type { BranchContextState } from "@/components/settings/BranchSettings";

type Props = {
  open: boolean;
  onClose: () => void;
  contextState: BranchContextState | null;
};

export function ContextStateDialog({ open, onClose, contextState }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const factsEntries = contextState ? Object.entries(contextState.facts) : [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-auto w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex max-h-[80vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Context State
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
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
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          {!contextState ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No context state available.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Facts Table */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Facts
                </h3>
                {factsEntries.length > 0 ? (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="py-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                            Key
                          </th>
                          <th className="py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {factsEntries.map(([key, value], i) => (
                          <tr
                            key={key}
                            className={
                              i % 2 === 0
                                ? "bg-zinc-50 dark:bg-zinc-800/50"
                                : ""
                            }
                          >
                            <td className="py-1.5 pr-4 font-medium text-zinc-700 dark:text-zinc-300">
                              {key}
                            </td>
                            <td className="py-1.5 text-zinc-600 dark:text-zinc-400">
                              {value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Extracted up to message #{contextState.factsExtractedUpTo}
                    </p>
                  </>
                ) : (
                  <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                    No facts extracted yet
                  </p>
                )}
              </div>

              {/* Summary Section */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Summary
                </h3>
                {contextState.context ? (
                  <>
                    <div className="rounded-lg border border-zinc-200 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                      {contextState.context}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Summarized up to message #{contextState.summarizedUpTo}
                    </p>
                  </>
                ) : (
                  <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                    No summary yet
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
