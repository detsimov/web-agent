"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: ChatMessage[];
  isLoading: boolean;
};

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message or loading change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {messages.map((msg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: messages have no stable ID
        <MessageBubble key={i} message={msg} />
      ))}
      {isLoading && (
        <div className="flex items-start">
          <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
