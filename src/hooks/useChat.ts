"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@/lib/types";

type UseChatOptions = {
  model?: string;
  maxTokens?: number;
  instructions?: string;
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

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            model: options.model,
            maxTokens: options.maxTokens,
            instructions: options.instructions,
          }),
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
    [messages, options.model, options.maxTokens, options.instructions],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, reset };
}
