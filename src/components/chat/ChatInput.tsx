"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onSend: (message: string) => void;
  disabled: boolean;
};

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}
