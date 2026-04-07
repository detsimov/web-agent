"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/CopyButton";
import type { ChatMessage, ToolCallInfo } from "@/lib/types";
import { UsageBadge } from "./UsageBadge";

type Props = {
  message: ChatMessage;
  onOpenMenu?: (position: { x: number; y: number }) => void;
};

export function MessageBubble({ message, onOpenMenu }: Props) {
  const isUser = message.role === "user";
  const actionRef = useRef<HTMLButtonElement>(null);
  const toolCalls = message.toolCalls ?? [];
  const hasToolCalls = !isUser && toolCalls.length > 0;
  const hasContent = message.content.length > 0;

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
          {hasToolCalls && (
            <ToolCallsBlock toolCalls={toolCalls} hasContent={hasContent} />
          )}
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : hasContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : null}
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

function ToolCallsBlock({
  toolCalls,
  hasContent,
}: {
  toolCalls: ToolCallInfo[];
  hasContent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const errorCount = toolCalls.filter((tc) => tc.isError).length;

  return (
    <div className={hasContent ? "mb-2" : ""}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span>
          {toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""} used
          {errorCount > 0 && (
            <span className="ml-1 text-red-500 dark:text-red-400">
              ({errorCount} {errorCount === 1 ? "error" : "errors"})
            </span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-auto shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {toolCalls.map((tc, i) => (
            <ToolCallItem key={`${tc.toolName}-${i}`} tc={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallItem({ tc }: { tc: ToolCallInfo }) {
  const [showResult, setShowResult] = useState(false);
  const resultText =
    tc.result === undefined
      ? ""
      : typeof tc.result === "string"
        ? tc.result
        : JSON.stringify(tc.result, null, 2);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowResult((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
      >
        {tc.isError ? (
          <span className="shrink-0 text-red-500">&times;</span>
        ) : (
          <span className="shrink-0 text-emerald-500 dark:text-emerald-400">
            &#10003;
          </span>
        )}
        <span className="min-w-0 truncate font-mono text-zinc-600 dark:text-zinc-300">
          {tc.serverName}
          <span className="text-zinc-400 dark:text-zinc-500">/</span>
          {tc.toolName}
        </span>
        {resultText && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`ml-auto shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${showResult ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>
      {showResult && resultText && (
        <pre className="mt-0.5 ml-5 max-h-40 overflow-auto rounded bg-zinc-200/50 px-2 py-1 font-mono text-[11px] whitespace-pre-wrap text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
          {resultText}
        </pre>
      )}
    </div>
  );
}
