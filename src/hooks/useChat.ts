"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

type UseChatOptions = {
  model?: string;
  maxTokens?: number;
  instructions?: string;
  chatId?: number | null;
  branchId?: number | null;
};

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Cancel any in-flight request
      abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const allMessages = [...messages, userMessage].map(
          ({ role, content }) => ({ role, content }),
        );

        const payload: Record<string, unknown> = {
          messages:
            options.branchId || options.chatId
              ? [{ role: "user", content }]
              : allMessages,
          model: options.model,
          maxTokens: options.maxTokens,
        };

        if (options.branchId) {
          payload.branchId = options.branchId;
        } else if (options.chatId) {
          payload.chatId = options.chatId;
        } else {
          payload.instructions = options.instructions;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }

        const contentType = res.headers.get("content-type") ?? "";

        if (contentType.includes("text/event-stream")) {
          await handleStreamingResponse(res, setMessages, controller.signal);
        } else {
          const data = await res.json();
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.content,
            usage: data.usage,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        // Only clear loading if this controller is still the active one
        if (abortRef.current === controller) {
          setIsLoading(false);
          abortRef.current = null;
        }
      }
    },
    [
      abort,
      messages,
      options.branchId,
      options.chatId,
      options.model,
      options.maxTokens,
      options.instructions,
    ],
  );

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, [abort]);

  const loadMessages = useCallback(
    (msgs: ChatMessage[]) => {
      abort();
      setMessages(msgs);
      setError(null);
      setIsLoading(false);
    },
    [abort],
  );

  const removeMessage = useCallback((messageId: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const restoreMessage = useCallback((message: ChatMessage, index: number) => {
    setMessages((prev) => {
      const restored = [...prev];
      restored.splice(Math.min(index, restored.length), 0, message);
      return restored;
    });
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    abort,
    reset,
    loadMessages,
    removeMessage,
    restoreMessage,
  };
}

async function handleStreamingResponse(
  res: Response,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  signal: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let assistantAdded = false;

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const chunk = JSON.parse(line.slice(6)) as
          | { type: "delta"; content: string }
          | {
              type: "done";
              content: string;
              usage: ChatMessage["usage"];
            }
          | { type: "error"; error: string };

        if (chunk.type === "delta") {
          if (!assistantAdded) {
            assistantAdded = true;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: chunk.content },
            ]);
          } else {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + chunk.content },
                ];
              }
              return prev;
            });
          }
        }

        if (chunk.type === "done") {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: chunk.content, usage: chunk.usage },
              ];
            }
            return [
              ...prev,
              {
                role: "assistant",
                content: chunk.content,
                usage: chunk.usage,
              },
            ];
          });
        }

        if (chunk.type === "error") {
          throw new Error(chunk.error);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
