"use client";

import { useState } from "react";
import type { McpStatus } from "@/lib/mcp/types";

type McpTool = {
  name: string;
  description: string;
};

type McpServer = {
  id: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: number;
  status: McpStatus;
  error?: string;
  toolCount: number;
  tools: McpTool[];
};

type Props = {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onReconnect: () => void;
};

const STATUS_COLORS: Record<McpStatus, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-zinc-400",
  error: "bg-red-500",
};

const TYPE_LABELS: Record<string, string> = {
  stdio: "stdio",
  http: "HTTP",
  sse: "SSE",
};

export function McpServerCard({
  server,
  onEdit,
  onDelete,
  onReconnect,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const configDisplay =
    server.type === "stdio"
      ? ((server.config as { command?: string }).command ?? "")
      : ((server.config as { url?: string }).url ?? "");

  return (
    <div className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="mt-1.5 flex shrink-0">
          <span
            className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[server.status]}`}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {server.name}
            </span>
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
              {TYPE_LABELS[server.type] ?? server.type}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
            {configDisplay}
          </div>
          <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {server.status === "connected"
              ? `${server.toolCount} tools available`
              : server.status === "error"
                ? (server.error ?? "Connection error")
                : server.status}
          </div>

          {/* Error + reconnect */}
          {server.status === "error" && (
            <button
              type="button"
              onClick={onReconnect}
              className="mt-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              Reconnect
            </button>
          )}

          {/* Expandable tools list */}
          {server.status === "connected" && server.tools.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1.5 flex cursor-pointer items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {expanded ? "Hide tools" : "Show tools"}
              </button>
              {expanded && (
                <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-700">
                  {server.tools.map((tool) => (
                    <div key={tool.name} className="text-xs">
                      <span className="font-mono text-zinc-600 dark:text-zinc-300">
                        {tool.name}
                      </span>
                      {tool.description && (
                        <span className="ml-1.5 text-zinc-400 dark:text-zinc-500">
                          — {tool.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
