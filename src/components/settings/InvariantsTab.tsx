"use client";

import { useCallback, useEffect, useState } from "react";

type Invariant = {
  id: string;
  name: string;
  description: string;
  type: "regex" | "keyword" | null;
  pattern: string;
  caseSensitive: boolean;
  severity: "block" | "warn";
  promptHint: string;
  enabled: boolean;
};

type FormData = Omit<Invariant, "id">;

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  type: null,
  pattern: "",
  caseSensitive: false,
  severity: "block",
  promptHint: "",
  enabled: true,
};

function validate(data: FormData): string[] {
  const errs: string[] = [];
  if (!data.name.trim()) errs.push("Name is required");
  if (!data.description.trim()) errs.push("Description is required");
  if (data.type && !data.pattern.trim())
    errs.push("Pattern is required when type is set");
  return errs;
}

export function InvariantsTab() {
  const [invariants, setInvariants] = useState<Invariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);

  const fetchInvariants = useCallback(async () => {
    try {
      const res = await fetch("/api/invariants");
      const data = await res.json();
      setInvariants(data.invariants ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvariants();
  }, [fetchInvariants]);

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      // Optimistic update
      setInvariants((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, enabled } : inv)),
      );
      try {
        await fetch(`/api/invariants/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      } catch {
        fetchInvariants(); // revert on error
      }
    },
    [fetchInvariants],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic removal
      setInvariants((prev) => prev.filter((inv) => inv.id !== id));
      try {
        await fetch(`/api/invariants/${id}`, { method: "DELETE" });
      } catch {
        fetchInvariants();
      }
    },
    [fetchInvariants],
  );

  const startEdit = useCallback((inv: Invariant) => {
    setEditing(inv.id);
    setForm({
      name: inv.name,
      description: inv.description,
      type: inv.type,
      pattern: inv.pattern,
      caseSensitive: inv.caseSensitive,
      severity: inv.severity,
      promptHint: inv.promptHint,
      enabled: inv.enabled,
    });
    setErrors([]);
  }, []);

  const startCreate = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setErrors([]);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setErrors([]);
  }, []);

  const handleSave = useCallback(async () => {
    const errs = validate(form);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    try {
      if (editing === "new") {
        await fetch("/api/invariants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch(`/api/invariants/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setEditing(null);
      fetchInvariants();
    } catch {
      setErrors(["Failed to save"]);
    }
  }, [editing, form, fetchInvariants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  // Show form when editing
  if (editing !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {editing === "new" ? "Add Invariant" : "Edit Invariant"}
          </h3>
          <button
            type="button"
            onClick={cancelEdit}
            className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {errors.join(", ")}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g., no-eval"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description
          </span>
          <input
            type="text"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="e.g., Prevent use of eval() in code"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <fieldset>
          <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Pattern Matching (optional)
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="type"
                checked={form.type === null}
                onChange={() =>
                  setForm((f) => ({ ...f, type: null, pattern: "" }))
                }
                className="accent-blue-500"
              />
              <span className="text-zinc-700 dark:text-zinc-300">none</span>
            </label>
            {(["regex", "keyword"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={form.type === t}
                  onChange={() => setForm((f) => ({ ...f, type: t }))}
                  className="accent-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-300">{t}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {form.type && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Pattern
              </span>
              <input
                type="text"
                value={form.pattern}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pattern: e.target.value }))
                }
                placeholder={
                  form.type === "regex"
                    ? "e.g., eval\\("
                    : "e.g., TODO, FIXME, HACK"
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.caseSensitive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, caseSensitive: e.target.checked }))
                }
                className="accent-blue-500"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Case sensitive
              </span>
            </label>
          </>
        )}

        <fieldset>
          <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Severity
          </legend>
          <div className="flex gap-4">
            {(["block", "warn"] as const).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="severity"
                  value={s}
                  checked={form.severity === s}
                  onChange={() => setForm((f) => ({ ...f, severity: s }))}
                  className="accent-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-300">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Prompt Hint
          </span>
          <input
            type="text"
            value={form.promptHint}
            onChange={(e) =>
              setForm((f) => ({ ...f, promptHint: e.target.value }))
            }
            placeholder="e.g., Rewrite without eval()"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Invariants
        </h3>
        <button
          type="button"
          onClick={startCreate}
          className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add Invariant
        </button>
      </div>

      {invariants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No invariants configured yet.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Add rules to enforce across all chats.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {invariants.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {inv.name}
                  </span>
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {inv.type ?? "prompt-only"}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      inv.severity === "block"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {inv.severity}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-700">
                    {inv.pattern || inv.description}
                  </code>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(inv)}
                  className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="Edit"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(inv.id)}
                  className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  title="Delete"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
                <label className="relative ml-1 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={inv.enabled}
                    onChange={(e) => handleToggle(inv.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-zinc-300 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4 dark:bg-zinc-600" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
