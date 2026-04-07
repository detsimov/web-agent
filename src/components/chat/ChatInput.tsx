"use client";

import { useCallback, useRef, useState } from "react";
import type { MachineStateData } from "@/hooks/useChat";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import { McpPicker } from "./McpPicker";
import { StylePicker } from "./StylePicker";

export type SendOptions = {
  planningMode?: boolean;
};

type Props = {
  onSend: (message: string, options?: SendOptions) => void;
  disabled: boolean;
  communicationStyle: CommunicationStyleKey;
  globalCommunicationStyle: CommunicationStyleKey;
  onStyleChange: (style: CommunicationStyleKey | null) => void;
  machineState: MachineStateData | null;
  branchId: number | null;
  onOpenMcpSettings: () => void;
};

export function ChatInput({
  onSend,
  disabled,
  communicationStyle,
  globalCommunicationStyle,
  onStyleChange,
  machineState,
  branchId,
  onOpenMcpSettings,
}: Props) {
  const [value, setValue] = useState("");
  const [planningMode, setPlanningMode] = useState(false);
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

    onSend(trimmed, planningMode ? { planningMode: true } : undefined);

    setValue("");
    setPlanningMode(false);
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
  const machineActive = machineState?.status === "active";

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
          placeholder={
            planningMode ? "Describe what to plan..." : "Type a message..."
          }
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            <StylePicker
              value={communicationStyle}
              globalDefault={globalCommunicationStyle}
              onChange={onStyleChange}
            />
            <McpPicker branchId={branchId} onOpenSettings={onOpenMcpSettings} />
            {!machineActive && (
              <button
                type="button"
                onClick={() => setPlanningMode((p) => !p)}
                className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  planningMode
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                }`}
                aria-label="Toggle planning mode"
                title="Send with planning workflow"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                  <path d="M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Plan
              </button>
            )}
          </div>
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
