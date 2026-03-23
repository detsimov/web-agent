"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
};

export function InstructionsDialog({ open, value, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(value);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setDraft(value);
      el.showModal();
      textareaRef.current?.focus();
    } else {
      el.close();
    }
  }, [open, value]);

  const handleSave = useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for dialog */}
      <div className="flex flex-col gap-4 p-6" onKeyDown={handleKeyDown}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          System Message
        </h2>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400"
          placeholder="Enter instructions for the AI..."
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {draft.length}/4000
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
