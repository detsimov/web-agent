export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type Model = {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
};

export type ChatMessage = Message & {
  id?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number | null;
  } | null;
  invariantViolation?: string;
  invariantWarnings?: string[];
};

export type PersistedMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type Chat = {
  id: number;
  name: string;
  createdAt: string;
};
