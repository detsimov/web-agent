"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMMUNICATION_STYLES,
  type CommunicationStyleKey,
} from "@/lib/communication-styles";

type Props = {
  value: CommunicationStyleKey;
  globalDefault: CommunicationStyleKey;
  onChange: (style: CommunicationStyleKey | null) => void;
};

const STYLE_KEYS = Object.keys(COMMUNICATION_STYLES) as CommunicationStyleKey[];

export function StylePicker({ value, globalDefault, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const isActive = value !== "normal";

  function handleSelect(key: CommunicationStyleKey) {
    onChange(key === globalDefault ? null : key);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        title={`Стиль общения: ${COMMUNICATION_STYLES[value].label}`}
        aria-label="Communication style"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
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
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
          <line x1="16" y1="8" x2="2" y2="22" />
          <line x1="17.5" y1="15" x2="9" y2="15" />
        </svg>
        {isActive && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-0.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Стиль общения
          </div>
          {STYLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
                key === value
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
              }`}
            >
              {COMMUNICATION_STYLES[key].label}
              {key === value && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
          <div className="mt-0.5 border-t border-zinc-100 px-2.5 pt-1.5 pb-0.5 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            По умолчанию: {COMMUNICATION_STYLES[globalDefault].label}
          </div>
        </div>
      )}
    </div>
  );
}
