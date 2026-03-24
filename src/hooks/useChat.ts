"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@/lib/types";

type UseChatOptions = {
  model?: string;
  maxTokens?: number;
  instructions?: string;
  chatId?: number | null;
};

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const allMessages = [...messages, userMessage].map(
          ({ role, content }) => ({ role, content }),
        );

        const payload: Record<string, unknown> = {
          messages: options.chatId ? [{ role: "user", content }] : allMessages,
        };

        if (options.chatId) {
          payload.chatId = options.chatId;
        } else {
          payload.model = options.model;
          payload.maxTokens = options.maxTokens;
          payload.instructions = options.instructions;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }

        const data = await res.json();

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.content,
          usage: data.usage,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [
      messages,
      options.chatId,
      options.model,
      options.maxTokens,
      options.instructions,
    ],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    setError(null);
  }, []);

  const removeMessage = useCallback((messageId: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    reset,
    loadMessages,
    removeMessage,
  };
}
