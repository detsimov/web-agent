"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import type { ChatMessage } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: ChatMessage[];
  isLoading: boolean;
  onDeleteMessage?: (messageId: number) => void;
  showDeleteButton?: boolean;
  forkedAtMsgId?: number | null;
  isMainBranch?: boolean;
  onForkFromMessage?: (messageId: number) => void;
};

export function MessageList({
  messages,
  isLoading,
  onDeleteMessage,
  showDeleteButton,
  forkedAtMsgId,
  isMainBranch,
  onForkFromMessage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [menuTarget, setMenuTarget] = useState<ChatMessage | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message or loading change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
    setMenuPosition(null);
  }, []);

  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  const menuItems = menuTarget
    ? [
        {
          label: "Copy",
          onClick: () => {
            navigator.clipboard.writeText(menuTarget.content);
          },
        },
        ...(isMainBranch &&
        menuTarget.role === "assistant" &&
        menuTarget.id &&
        onForkFromMessage
          ? [
              {
                label: "Fork from here",
                onClick: () => onForkFromMessage(menuTarget.id as number),
              },
            ]
          : []),
        ...(showDeleteButton && menuTarget.id && onDeleteMessage
          ? [
              { separator: true as const },
              {
                label: "Delete",
                variant: "destructive" as const,
                onClick: () => onDeleteMessage(menuTarget.id as number),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {messages.map((msg, i) => {
        const isInherited =
          forkedAtMsgId != null && msg.id != null && msg.id <= forkedAtMsgId;
        const showDivider =
          forkedAtMsgId != null &&
          msg.id != null &&
          msg.id <= forkedAtMsgId &&
          (i === messages.length - 1 ||
            (messages[i + 1]?.id != null &&
              (messages[i + 1].id as number) > forkedAtMsgId));

        return (
          <div key={`${msg.id ?? "pending"}-${i}`}>
            <div className={isInherited ? "opacity-60" : ""}>
              <MessageBubble
                message={msg}
                onOpenMenu={
                  msg.id
                    ? (position) => {
                        setMenuTarget(msg);
                        setMenuPosition(position);
                      }
                    : undefined
                }
              />
            </div>
            {showDivider && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
                <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                  fork point
                </span>
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
              </div>
            )}
          </div>
        );
      })}
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

      {menuTarget && menuPosition && (
        <ContextMenu
          items={menuItems}
          position={menuPosition}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
