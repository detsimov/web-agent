"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/CopyButton";
import type { ChatMessage } from "@/lib/types";
import { UsageBadge } from "./UsageBadge";

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
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
      {!isUser && (
        <div className="flex items-center gap-2 px-1">
          <CopyButton text={message.content} />
          {message.usage && <UsageBadge usage={message.usage} />}
        </div>
      )}
    </div>
  );
}
