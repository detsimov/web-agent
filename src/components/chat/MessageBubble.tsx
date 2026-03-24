"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/CopyButton";
import type { ChatMessage } from "@/lib/types";
import { UsageBadge } from "./UsageBadge";

type Props = {
  message: ChatMessage;
  onDelete?: () => void;
};

export function MessageBubble({ message, onDelete }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`group/msg flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
    >
      <div className="relative">
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isUser
              ? "min-w-[120px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="absolute -top-2 -right-2 rounded-full border border-zinc-200 bg-white p-1 text-zinc-400 opacity-0 shadow-sm transition-opacity hover:text-red-500 group-hover/msg:opacity-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:text-red-400"
            aria-label="Delete message"
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
              <path d="M18 6 6 18M6 6l12 12" />
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
