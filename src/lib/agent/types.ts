export type AgentConfig = {
  model: string;
  maxTokens: number;
  instructions: string;
};

export type AgentResponse = {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
};
