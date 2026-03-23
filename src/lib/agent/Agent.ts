import {chat} from "@/lib/chat";
import type {Message} from "@/lib/types";
import {
    DEFAULT_INSTRUCTIONS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_MODEL,
} from "./constants";
import type {AgentConfig, AgentResponse} from "./types";

export class Agent {
    private config: AgentConfig;

    constructor(config: Partial<AgentConfig> = {}) {
        this.config = {
            model: config.model ?? DEFAULT_MODEL,
            maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
            instructions: config.instructions ?? DEFAULT_INSTRUCTIONS,
        };
    }

    async run(messages: Message[]): Promise<AgentResponse> {
        const enrichedMessages: Message[] = [
            {role: "system", content: this.config.instructions},
            ...messages,
        ];

        const result = await chat(enrichedMessages, {
            model: this.config.model,
            maxTokens: this.config.maxTokens,
        });

        return {
            content: result.data,
            usage: result.usage,
        };
    }
}
