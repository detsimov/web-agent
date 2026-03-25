"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Chat, ChatMessage } from "@/lib/types";
import { ChatItem } from "./ChatItem";
import { SessionStats } from "./SessionStats";

type Props = {
  activeChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: number) => void;
  refreshKey: number;
  messages: ChatMessage[];
  contextLength: number;
  pricing?: { prompt: string; completion: string } | null;
};

export function ChatSidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  refreshKey,
  messages,
  contextLength,
  pricing,
}: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const fetchChats = useCallback(async () => {
    const res = await fetch("/api/chats");
    if (res.ok) {
      const data = await res.json();
      setChats(data.chats);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh when refreshKey changes
  useEffect(() => {
    fetchChats();
  }, [fetchChats, refreshKey]);

  const handleRename = async (chatId: number, newName: string) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, name: newName } : c)),
      );
    }
  };

  const handleDelete = async (chatId: number) => {
    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      onDeleteChat(chatId);
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 left-3 z-30 rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-600 md:hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        aria-label="Toggle sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern
        <div
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
          onKeyDown={() => {}}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } fixed top-0 left-0 z-20 flex h-full w-64 flex-col border-r border-zinc-300 bg-zinc-50 transition-transform md:static md:translate-x-0 dark:border-zinc-700 dark:bg-zinc-900/50`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-3 dark:border-zinc-700">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Chats
          </span>
          <button
            type="button"
            onClick={onNewChat}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {chats.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-400">
              No chats yet
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {chats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  onSelect={() => onSelectChat(chat.id)}
                  onRename={(name) => handleRename(chat.id, name)}
                  onDelete={() => setPendingDeleteId(chat.id)}
                />
              ))}
            </div>
          )}
        </div>

        <SessionStats messages={messages} contextLength={contextLength} pricing={pricing} />
      </aside>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete chat"
        message={`Are you sure you want to delete "${chats.find((c) => c.id === pendingDeleteId)?.name ?? "this chat"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingDeleteId !== null) {
            handleDelete(pendingDeleteId);
          }
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
