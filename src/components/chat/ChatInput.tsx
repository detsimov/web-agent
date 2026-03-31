"use client";

import { useCallback, useRef, useState } from "react";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import { StylePicker } from "./StylePicker";

type Props = {
  onSend: (message: string) => void;
  disabled: boolean;
  communicationStyle: CommunicationStyleKey;
  globalCommunicationStyle: CommunicationStyleKey;
  onStyleChange: (style: CommunicationStyleKey | null) => void;
};

export function ChatInput({
  onSend,
  disabled,
  communicationStyle,
  globalCommunicationStyle,
  onStyleChange,
}: Props) {
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

  const canSend = !disabled && !!value.trim();

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
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
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <StylePicker
            value={communicationStyle}
            globalDefault={globalCommunicationStyle}
            onChange={onStyleChange}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
              canSend
                ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                : "cursor-default text-zinc-300 dark:text-zinc-600"
            }`}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
