"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BranchMcpServer = {
  id: number;
  name: string;
  type: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  globalEnabled: boolean;
  branchEnabled: boolean;
  hasOverride: boolean;
  toolCount: number;
};

type Props = {
  branchId: number | null;
  onOpenSettings: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-zinc-400",
  error: "bg-red-500",
};

export function McpPicker({ branchId, onOpenSettings }: Props) {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<BranchMcpServer[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchServers = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await fetch(`/api/branches/${branchId}/mcp`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } catch {
      // Ignore fetch errors
    }
  }, [branchId]);

  // Fetch on open
  useEffect(() => {
    if (open) fetchServers();
  }, [open, fetchServers]);

  // Poll statuses while open
  useEffect(() => {
    if (!open || !branchId) return;
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
                | { status: BranchMcpServer["status"]; toolCount: number }
                | undefined;
              return st
                ? { ...s, status: st.status, toolCount: st.toolCount }
                : s;
            }),
          );
        }
      } catch {
        // Ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [open, branchId]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleToggle(serverId: number, currentEnabled: boolean) {
    // Optimistic update
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId ? { ...s, branchEnabled: !currentEnabled } : s,
      ),
    );

    try {
      await fetch(`/api/branches/${branchId}/mcp/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
    } catch {
      // Revert on error
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId ? { ...s, branchEnabled: currentEnabled } : s,
        ),
      );
    }
  }

  // Only show globally-enabled servers in the picker
  const visibleServers = servers.filter((s) => s.globalEnabled);
  const enabledCount = visibleServers.filter((s) => s.branchEnabled).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        title="MCP Servers"
        aria-label="MCP Servers"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
        </svg>
        {enabledCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white dark:bg-indigo-400">
            {enabledCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-0.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            MCP Servers
          </div>

          {visibleServers.length === 0 && (
            <div className="px-2.5 py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No MCP servers configured
            </div>
          )}

          {visibleServers.map((server) => (
            <div
              key={server.id}
              className="flex items-center justify-between rounded-lg px-2.5 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[server.status] ?? "bg-zinc-400"}`}
                />
                <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {server.name}
                </span>
                {server.status === "connected" && (
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {server.toolCount}
                  </span>
                )}
              </div>
              {server.status === "error" ? (
                <span className="text-xs text-red-500">Error</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggle(server.id, server.branchEnabled)}
                  className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                    server.branchEnabled
                      ? "bg-indigo-500 dark:bg-indigo-400"
                      : "bg-zinc-200 dark:bg-zinc-600"
                  }`}
                  aria-label={`Toggle ${server.name}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                      server.branchEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          ))}

          <div className="mt-0.5 border-t border-zinc-100 px-2.5 pt-1.5 pb-0.5 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Manage in Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
