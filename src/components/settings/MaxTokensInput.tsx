"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  max: number;
};

export function MaxTokensInput({ value, onChange, max }: Props) {
  const [input, setInput] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput(String(value));
  }, [value]);

  function validate(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1) {
      setError("Min: 1");
      return;
    }
    if (n > max) {
      setError(`Max: ${max.toLocaleString()}`);
      return;
    }
    setError(null);
    onChange(n);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label
        htmlFor="max-tokens-input"
        className="text-xs text-zinc-500 dark:text-zinc-400"
      >
        Max tokens
      </label>
      <input
        id="max-tokens-input"
        type="number"
        min={1}
        max={max}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          validate(e.target.value);
        }}
        onBlur={() => validate(input)}
        className={`w-28 rounded-md border px-2 py-1.5 text-sm outline-none ${
          error
            ? "border-red-400 dark:border-red-500"
            : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-600 dark:focus:border-zinc-400"
        } bg-white dark:bg-zinc-800 dark:text-zinc-100`}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
