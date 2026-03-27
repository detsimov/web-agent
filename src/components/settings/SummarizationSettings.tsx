"use client";

import { useCallback, useState } from "react";
import { ModelSelector } from "@/components/settings/ModelSelector";
import type { Model } from "@/lib/types";

export type SummarizationConfig = {
  summarizationStrategy: string | null;
  summarizationModel: string | null;
  summarizationEvery: number | null;
  summarizationRatio: number | null;
  summarizationKeep: number | null;
};

export type SummaryState = {
  core: string[];
  context: string;
  summarizedUpTo: number;
};

type Props = {
  config: SummarizationConfig;
  onUpdate: (patch: Partial<SummarizationConfig>) => void;
  models: Model[];
  modelsLoading: boolean;
  summaryState: SummaryState | null;
};

export function SummarizationSettings({
  config,
  onUpdate,
  models,
  modelsLoading,
  summaryState,
}: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const strategy = config.summarizationStrategy;

  const handleStrategyChange = useCallback(
    (value: string) => {
      if (value === "off") {
        onUpdate({
          summarizationStrategy: null,
          summarizationModel: null,
          summarizationEvery: null,
          summarizationRatio: null,
          summarizationKeep: null,
        });
      } else if (value === "window") {
        onUpdate({
          summarizationStrategy: "window",
          summarizationEvery: config.summarizationEvery ?? 10,
          summarizationKeep: config.summarizationKeep ?? 4,
        });
      } else if (value === "percentage") {
        onUpdate({
          summarizationStrategy: "percentage",
          summarizationRatio: config.summarizationRatio ?? 0.75,
          summarizationKeep: config.summarizationKeep ?? 4,
        });
      }
    },
    [
      onUpdate,
      config.summarizationEvery,
      config.summarizationRatio,
      config.summarizationKeep,
    ],
  );

  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Summarization
        </span>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          title="Preview summarization prompt"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            {showPrompt ? (
              <path
                fillRule="evenodd"
                d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z"
                clipRule="evenodd"
              />
            ) : (
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            )}
            {showPrompt ? (
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.665 10.6a1.651 1.651 0 000 1.186A10.004 10.004 0 0010 18c.868 0 1.71-.11 2.515-.318l.064-.014-.125-.064z" />
            ) : (
              <>
                <path
                  fillRule="evenodd"
                  d="M.458 10a11.5 11.5 0 0119.084 0 1.651 1.651 0 010 1.186A11.5 11.5 0 01.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </>
            )}
          </svg>
        </button>
      </div>

      {showPrompt && (
        <div className="mb-2 max-h-48 overflow-auto rounded-md bg-zinc-100 p-2 text-[10px] leading-relaxed text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {summaryState &&
          (summaryState.core.length > 0 || summaryState.context) ? (
            <>
              <div className="mb-1 font-semibold text-zinc-500 dark:text-zinc-400">
                [CORE]
              </div>
              {summaryState.core.length > 0 ? (
                <ul className="mb-2 list-disc pl-3">
                  {summaryState.core.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 italic text-zinc-400 dark:text-zinc-500">
                  Empty
                </p>
              )}
              <div className="mb-1 font-semibold text-zinc-500 dark:text-zinc-400">
                [CONTEXT]
              </div>
              <p>{summaryState.context || "Empty"}</p>
            </>
          ) : (
            <p className="italic text-zinc-400 dark:text-zinc-500">
              No summary yet — it will appear after summarization runs.
            </p>
          )}
        </div>
      )}

      {/* Strategy radio group */}
      <div className="mb-2 flex gap-2">
        {(["off", "window", "percentage"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300"
          >
            <input
              type="radio"
              name="summarization-strategy"
              value={value}
              checked={value === "off" ? !strategy : strategy === value}
              onChange={() => handleStrategyChange(value)}
              className="accent-zinc-700 dark:accent-zinc-300"
            />
            {value === "off" ? "Off" : value === "window" ? "Window" : "Pct"}
          </label>
        ))}
      </div>

      {strategy && (
        <div className="flex flex-col gap-2">
          {/* Model selector */}
          <div>
            <span className="mb-0.5 block text-[10px] text-zinc-400 dark:text-zinc-500">
              Model
            </span>
            <ModelSelector
              models={models}
              value={config.summarizationModel ?? ""}
              onChange={(id) => onUpdate({ summarizationModel: id })}
              isLoading={modelsLoading}
            />
          </div>

          {/* Strategy-specific inputs */}
          {strategy === "window" && (
            <label>
              <span className="mb-0.5 block text-[10px] text-zinc-400 dark:text-zinc-500">
                Every (messages)
              </span>
              <input
                type="number"
                min={2}
                value={config.summarizationEvery ?? 10}
                onChange={(e) =>
                  onUpdate({
                    summarizationEvery:
                      Number.parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          )}

          {strategy === "percentage" && (
            <label>
              <span className="mb-0.5 block text-[10px] text-zinc-400 dark:text-zinc-500">
                Ratio (%)
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={Math.round((config.summarizationRatio ?? 0.75) * 100)}
                onChange={(e) =>
                  onUpdate({
                    summarizationRatio:
                      (Number.parseInt(e.target.value, 10) || 75) / 100,
                  })
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          )}

          <label>
            <span className="mb-0.5 block text-[10px] text-zinc-400 dark:text-zinc-500">
              Keep (recent messages)
            </span>
            <input
              type="number"
              min={0}
              value={config.summarizationKeep ?? 4}
              onChange={(e) =>
                onUpdate({
                  summarizationKeep: Number.parseInt(e.target.value, 10) || 4,
                })
              }
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>
      )}
    </div>
  );
}
