export type McpTransportType = "stdio" | "http" | "sse";

export type StdioConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type HttpConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type SseConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type McpServerConfig = StdioConfig | HttpConfig | SseConfig;

export type McpStatus = "connected" | "connecting" | "disconnected" | "error";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ConnectionEntry = {
  serverId: number;
  name: string;
  type: McpTransportType;
  status: McpStatus;
  error?: string;
  tools: McpToolDefinition[];
  client: unknown; // MCP Client instance
  transport: unknown; // MCP Transport instance
};

export type McpStatusInfo = {
  id: number;
  status: McpStatus;
  error?: string;
  toolCount: number;
};

export type McpResource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type McpResourceContent = {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
};

export type McpPrompt = {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

export type McpPromptMessage = {
  role: "user" | "assistant";
  content: string;
};
