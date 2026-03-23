"use client";

import { useCallback, useState } from "react";

type Props = {
  text: string;
};

export function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
