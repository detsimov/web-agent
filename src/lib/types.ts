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
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
};
