export type AgentConfig = {
  model: string;
  maxTokens: number;
  instructions: string;
};

export type AgentResponse = {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number | null;
  } | null;
};
