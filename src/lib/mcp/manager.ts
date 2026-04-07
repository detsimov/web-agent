import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  ConnectionEntry,
  HttpConfig,
  McpPrompt,
  McpPromptMessage,
  McpResource,
  McpResourceContent,
  McpStatusInfo,
  McpToolDefinition,
  McpTransportType,
  SseConfig,
  StdioConfig,
} from "./types";

const GLOBAL_KEY = "__mcpConnectionManager__" as const;

// biome-ignore lint: loose config type for dynamic JSON from DB
type AnyConfig = Record<string, any>;

type McpManager = {
  connections: Map<number, ConnectionEntry>;
  connect(
    serverId: number,
    name: string,
    type: McpTransportType,
    config: AnyConfig,
  ): Promise<void>;
  disconnect(serverId: number): Promise<void>;
  getStatus(serverId: number): McpStatusInfo | null;
  getAllStatuses(): McpStatusInfo[];
  getTools(serverId: number): McpToolDefinition[];
  callTool(
    serverId: number,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  listResources(serverId: number): Promise<McpResource[]>;
  readResource(serverId: number, uri: string): Promise<McpResourceContent[]>;
  listPrompts(serverId: number): Promise<McpPrompt[]>;
  getPrompt(
    serverId: number,
    name: string,
    args?: Record<string, string>,
  ): Promise<McpPromptMessage[]>;
};

function createTransport(type: McpTransportType, config: AnyConfig) {
  switch (type) {
    case "stdio": {
      const c = config as StdioConfig;
      return new StdioClientTransport({
        command: c.command,
        args: c.args,
        env: c.env,
      });
    }
    case "http": {
      const c = config as HttpConfig;
      return new StreamableHTTPClientTransport(new URL(c.url), {
        requestInit: c.headers ? { headers: c.headers } : undefined,
      });
    }
    case "sse": {
      const c = config as SseConfig;
      return new SSEClientTransport(new URL(c.url), {
        requestInit: c.headers ? { headers: c.headers } : undefined,
      });
    }
  }
}

function createManager(): McpManager {
  const connections = new Map<number, ConnectionEntry>();

  async function connect(
    serverId: number,
    name: string,
    type: McpTransportType,
    config: AnyConfig,
  ) {
    // Disconnect existing if any
    if (connections.has(serverId)) {
      await disconnect(serverId);
    }

    const entry: ConnectionEntry = {
      serverId,
      name,
      type,
      status: "connecting",
      tools: [],
      client: null,
      transport: null,
    };
    connections.set(serverId, entry);

    try {
      const transport = createTransport(type, config);
      const client = new Client({
        name: `web-agent-${name}`,
        version: "1.0.0",
      });

      entry.transport = transport;
      entry.client = client;

      await client.connect(transport);
      entry.status = "connected";

      // Auto-restart on unexpected close (stdio crash, connection drop)
      transport.onclose = () => {
        if (entry.status === "connected") {
          entry.status = "error";
          entry.error = "Connection lost — auto-reconnecting...";
          entry.tools = [];
          // Schedule auto-reconnect with backoff
          setTimeout(async () => {
            try {
              const { db: dbInner } = await import("@/db");
              const { mcpServerTable: tbl } = await import("@/db/schema");
              const { eq: eqInner } = await import("drizzle-orm");
              const [srv] = await dbInner
                .select()
                .from(tbl)
                .where(eqInner(tbl.id, serverId));
              if (srv?.enabled) {
                await connect(
                  srv.id,
                  srv.name,
                  srv.type as McpTransportType,
                  JSON.parse(srv.config),
                );
              }
            } catch {
              // Auto-reconnect failed — will stay in error state
            }
          }, 3000);
        }
      };

      // Discover tools
      try {
        const result = await client.listTools();
        entry.tools = result.tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
        }));
      } catch {
        // Tool discovery failed but connection is still valid
        entry.tools = [];
      }
    } catch (err) {
      entry.status = "error";
      entry.error = err instanceof Error ? err.message : String(err);
    }
  }

  async function disconnect(serverId: number) {
    const entry = connections.get(serverId);
    if (!entry) return;

    try {
      const client = entry.client as Client | null;
      if (client) {
        await client.close();
      }
    } catch {
      // Ignore close errors
    }

    entry.status = "disconnected";
    entry.tools = [];
    entry.client = null;
    entry.transport = null;
    connections.delete(serverId);
  }

  function getStatus(serverId: number): McpStatusInfo | null {
    const entry = connections.get(serverId);
    if (!entry) return null;
    return {
      id: entry.serverId,
      status: entry.status,
      error: entry.error,
      toolCount: entry.tools.length,
    };
  }

  function getAllStatuses(): McpStatusInfo[] {
    return Array.from(connections.values()).map((entry) => ({
      id: entry.serverId,
      status: entry.status,
      error: entry.error,
      toolCount: entry.tools.length,
    }));
  }

  function getTools(serverId: number): McpToolDefinition[] {
    return connections.get(serverId)?.tools ?? [];
  }

  async function callTool(
    serverId: number,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const entry = connections.get(serverId);
    if (!entry || entry.status !== "connected") {
      throw new Error(`MCP server ${serverId} is not connected`);
    }
    const client = entry.client as Client;
    const result = await client.callTool({ name: toolName, arguments: args });
    // result.content is an array of content blocks
    const contents = result.content as Array<{
      type: string;
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
    // For simple text results, concatenate text blocks
    const textParts = contents
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text);
    if (textParts.length > 0) return textParts.join("\n");
    // Return raw content for non-text results
    return result.content;
  }

  async function listResources(serverId: number): Promise<McpResource[]> {
    const entry = connections.get(serverId);
    if (!entry || entry.status !== "connected") return [];
    const client = entry.client as Client;
    try {
      const result = await client.listResources();
      return result.resources.map((r) => ({
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description,
        mimeType: r.mimeType,
      }));
    } catch {
      return [];
    }
  }

  async function readResource(
    serverId: number,
    uri: string,
  ): Promise<McpResourceContent[]> {
    const entry = connections.get(serverId);
    if (!entry || entry.status !== "connected") return [];
    const client = entry.client as Client;
    const result = await client.readResource({ uri });
    return result.contents.map((c) => ({
      uri: c.uri,
      mimeType: c.mimeType,
      text: "text" in c ? (c.text as string) : undefined,
      blob: "blob" in c ? (c.blob as string) : undefined,
    }));
  }

  async function listPrompts(serverId: number): Promise<McpPrompt[]> {
    const entry = connections.get(serverId);
    if (!entry || entry.status !== "connected") return [];
    const client = entry.client as Client;
    try {
      const result = await client.listPrompts();
      return result.prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments?.map((a) => ({
          name: a.name,
          description: a.description,
          required: a.required,
        })),
      }));
    } catch {
      return [];
    }
  }

  async function getPrompt(
    serverId: number,
    name: string,
    args?: Record<string, string>,
  ): Promise<McpPromptMessage[]> {
    const entry = connections.get(serverId);
    if (!entry || entry.status !== "connected") return [];
    const client = entry.client as Client;
    const result = await client.getPrompt({ name, arguments: args });
    return result.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.type === "text"
            ? m.content.text
            : JSON.stringify(m.content),
    }));
  }

  return {
    connections,
    connect,
    disconnect,
    getStatus,
    getAllStatuses,
    getTools,
    callTool,
    listResources,
    readResource,
    listPrompts,
    getPrompt,
  };
}

// Singleton on globalThis to survive Next.js dev hot reloads
const globalObj = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: McpManager;
};

if (!globalObj[GLOBAL_KEY]) {
  globalObj[GLOBAL_KEY] = createManager();
}

export const mcpManager: McpManager = globalObj[GLOBAL_KEY];

let _autoConnectDone = false;

/**
 * Auto-connect all enabled MCP servers from DB.
 * Called lazily on first API request that needs MCP.
 */
export async function ensureAutoConnect() {
  if (_autoConnectDone) return;
  _autoConnectDone = true;

  try {
    // Dynamic import to avoid circular deps
    const { db } = await import("@/db");
    const { mcpServerTable } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const servers = await db
      .select()
      .from(mcpServerTable)
      .where(eq(mcpServerTable.enabled, 1));

    await Promise.allSettled(
      servers.map((s) =>
        mcpManager.connect(
          s.id,
          s.name,
          s.type as McpTransportType,
          JSON.parse(s.config),
        ),
      ),
    );
  } catch {
    // Auto-connect failed, will retry on individual requests
    _autoConnectDone = false;
  }
}
