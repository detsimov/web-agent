"use client";

import { useState } from "react";
import type { McpTransportType } from "@/lib/mcp/types";

type FormData = {
  name: string;
  type: McpTransportType;
  config: Record<string, unknown>;
};

type Props = {
  initial?: {
    name: string;
    type: McpTransportType;
    config: Record<string, unknown>;
  };
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving?: boolean;
};

export function McpServerForm({ initial, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<McpTransportType>(initial?.type ?? "stdio");

  // stdio fields
  const [command, setCommand] = useState(
    (initial?.config as { command?: string })?.command ?? "",
  );
  const [args, setArgs] = useState(
    ((initial?.config as { args?: string[] })?.args ?? []).join("\n"),
  );
  const [env, setEnv] = useState(
    Object.entries(
      (initial?.config as { env?: Record<string, string> })?.env ?? {},
    )
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );

  // http/sse fields
  const [url, setUrl] = useState(
    (initial?.config as { url?: string })?.url ?? "",
  );
  const [headers, setHeaders] = useState(
    Object.entries(
      (initial?.config as { headers?: Record<string, string> })?.headers ?? {},
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let config: Record<string, unknown>;
    if (type === "stdio") {
      const parsedArgs = args
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedEnv: Record<string, string> = {};
      for (const line of env.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          parsedEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }
      config = {
        command,
        ...(parsedArgs.length > 0 && { args: parsedArgs }),
        ...(Object.keys(parsedEnv).length > 0 && { env: parsedEnv }),
      };
    } else {
      const parsedHeaders: Record<string, string> = {};
      for (const line of headers.split("\n")) {
        const colon = line.indexOf(":");
        if (colon > 0) {
          parsedHeaders[line.slice(0, colon).trim()] = line
            .slice(colon + 1)
            .trim();
        }
      }
      config = {
        url,
        ...(Object.keys(parsedHeaders).length > 0 && {
          headers: parsedHeaders,
        }),
      };
    }

    onSave({ name, type, config });
  }

  const canSubmit =
    name.trim() && (type === "stdio" ? command.trim() : url.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
    >
      {/* Name */}
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Name
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Browser, Filesystem"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
      </div>

      {/* Transport type */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Transport
        </div>
        <div className="flex gap-2">
          {(["stdio", "http", "sse"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                type === t
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
              }`}
            >
              {t === "stdio" ? "stdio" : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Transport-specific fields */}
      {type === "stdio" ? (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Command
            </div>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. node, npx, python"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Arguments (one per line)
            </div>
            <textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={"server.js\n--port\n3001"}
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Environment (KEY=VALUE per line)
            </div>
            <textarea
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              placeholder="NODE_ENV=production"
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              URL
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Headers (one per line, Name: Value)
            </div>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder="Authorization: Bearer token"
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving..." : initial ? "Save" : "Save & Connect"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
