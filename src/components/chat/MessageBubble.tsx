"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/CopyButton";
import type { ChatMessage } from "@/lib/types";
import { UsageBadge } from "./UsageBadge";

type Props = {
  message: ChatMessage;
  onOpenMenu?: (position: { x: number; y: number }) => void;
};

export function MessageBubble({ message, onOpenMenu }: Props) {
  const isUser = message.role === "user";
  const actionRef = useRef<HTMLButtonElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onOpenMenu) return;
    e.preventDefault();
    onOpenMenu({ x: e.clientX, y: e.clientY });
  };

  const handleActionClick = () => {
    if (!onOpenMenu || !actionRef.current) return;
    const rect = actionRef.current.getBoundingClientRect();
    onOpenMenu({ x: rect.right, y: rect.top });
  };

  return (
    <div
      className={`group/msg flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: custom context menu on message bubble */}
      <div
        className="relative max-w-[80%] min-w-0"
        onContextMenu={handleContextMenu}
      >
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "min-w-[120px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {onOpenMenu && (
          <button
            ref={actionRef}
            type="button"
            onClick={handleActionClick}
            className="absolute -top-2 -right-2 rounded-full border border-zinc-200 bg-white p-1 text-zinc-400 opacity-0 shadow-sm transition-opacity hover:text-zinc-600 group-hover/msg:opacity-100 coarse:opacity-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Message actions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}
      </div>
      {!isUser && (
        <div className="flex items-center gap-2 px-1">
          <CopyButton text={message.content} />
          {message.usage && <UsageBadge usage={message.usage} />}
        </div>
      )}
    </div>
  );
}
