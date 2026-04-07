"use client";

import { useCallback, useEffect, useState } from "react";
import type { McpTransportType } from "@/lib/mcp/types";
import { McpServerCard } from "./McpServerCard";
import { McpServerForm } from "./McpServerForm";

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
  status: "connected" | "connecting" | "disconnected" | "error";
  error?: string;
  toolCount: number;
  tools: McpTool[];
};

type FormMode =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; serverId: number };

export function McpServersTab() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>({ kind: "closed" });
  const [saving, setSaving] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Poll statuses while tab is visible
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/mcp-servers/status");
        if (res.ok) {
          const data = await res.json();
          const statusMap = new Map(
            data.statuses.map(
              (s: {
                id: number;
                status: string;
                error?: string;
                toolCount: number;
              }) => [s.id, s],
            ),
          );
          setServers((prev) =>
            prev.map((s) => {
              const st = statusMap.get(s.id) as
                | {
                    status: McpServer["status"];
                    error?: string;
                    toolCount: number;
                  }
                | undefined;
              return st
                ? {
                    ...s,
                    status: st.status,
                    error: st.error,
                    toolCount: st.toolCount,
                  }
                : s;
            }),
          );
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(data: {
    name: string;
    type: McpTransportType;
    config: Record<string, unknown>;
  }) {
    setSaving(true);
    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setFormMode({ kind: "closed" });
        await fetchServers();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    serverId: number,
    data: {
      name: string;
      type: McpTransportType;
      config: Record<string, unknown>;
    },
  ) {
    setSaving(true);
    try {
      const res = await fetch(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setFormMode({ kind: "closed" });
        await fetchServers();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serverId: number) {
    if (!confirm("Delete this MCP server?")) return;
    await fetch(`/api/mcp-servers/${serverId}`, { method: "DELETE" });
    await fetchServers();
  }

  async function handleReconnect(serverId: number) {
    await fetch(`/api/mcp-servers/${serverId}/connect`, { method: "POST" });
    await fetchServers();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-zinc-400 dark:text-zinc-500">
          Loading...
        </span>
      </div>
    );
  }

  // Empty state
  if (servers.length === 0 && formMode.kind === "closed") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-300 dark:text-zinc-600"
          aria-hidden="true"
        >
          <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
        </svg>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No MCP servers configured. Add one to connect external tools.
        </p>
        <button
          type="button"
          onClick={() => setFormMode({ kind: "add" })}
          className="mt-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add MCP Server
        </button>
      </div>
    );
  }

  const editingServer =
    formMode.kind === "edit"
      ? servers.find((s) => s.id === formMode.serverId)
      : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          MCP Servers
        </h3>
        {formMode.kind === "closed" && (
          <button
            type="button"
            onClick={() => setFormMode({ kind: "add" })}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            + Add MCP Server
          </button>
        )}
      </div>

      {formMode.kind === "add" && (
        <McpServerForm
          onSave={handleCreate}
          onCancel={() => setFormMode({ kind: "closed" })}
          saving={saving}
        />
      )}

      {formMode.kind === "edit" && editingServer && (
        <McpServerForm
          initial={{
            name: editingServer.name,
            type: editingServer.type as McpTransportType,
            config: editingServer.config,
          }}
          onSave={(data) => handleUpdate(editingServer.id, data)}
          onCancel={() => setFormMode({ kind: "closed" })}
          saving={saving}
        />
      )}

      {servers.map((server) =>
        formMode.kind === "edit" && formMode.serverId === server.id ? null : (
          <McpServerCard
            key={server.id}
            server={server}
            onEdit={() => setFormMode({ kind: "edit", serverId: server.id })}
            onDelete={() => handleDelete(server.id)}
            onReconnect={() => handleReconnect(server.id)}
          />
        ),
      )}
    </div>
  );
}
