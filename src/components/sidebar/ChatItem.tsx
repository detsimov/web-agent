"use client";

import { useEffect, useRef, useState } from "react";
import type { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

export function ChatItem({
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(chat.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const confirmRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chat.name) {
      onRename(trimmed);
    } else {
      setEditValue(chat.name);
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setEditValue(chat.name);
    setIsEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={confirmRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmRename();
            if (e.key === "Escape") cancelRename();
          }}
          className="flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setIsEditing(true)}
          className="flex-1 truncate text-left"
        >
          {chat.name}
        </button>
      )}

      {!isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
          aria-label="Delete chat"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
