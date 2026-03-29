export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AgentConfig = {
  model: string;
  maxTokens: number;
  instructions: string;
  tools?: ToolDefinition[];
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
