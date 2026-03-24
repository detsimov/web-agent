import { chat } from "@/lib/chat";
import type { Message, PersistedMessage } from "@/lib/types";
import {
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
} from "./constants";
import type { AgentConfig, AgentResponse } from "./types";

export class Agent {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      instructions: config.instructions ?? DEFAULT_INSTRUCTIONS,
    };
  }

  async run(
    history: PersistedMessage[],
    newMessage: string,
  ): Promise<AgentResponse> {
    const messages: Message[] = [
      { role: "system", content: this.config.instructions },
      ...history.map((m) => ({
        role: m.role as Message["role"],
        content: m.content,
      })),
      { role: "user" as const, content: newMessage },
    ];

    return this.call(messages);
  }

  async runStateless(messages: Message[]): Promise<AgentResponse> {
    const enrichedMessages: Message[] = [
      { role: "system", content: this.config.instructions },
      ...messages,
    ];

    return this.call(enrichedMessages);
  }

  private async call(messages: Message[]): Promise<AgentResponse> {
    const result = await chat(messages, {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
    });

    return {
      content: result.data,
      usage: result.usage,
    };
  }
}
