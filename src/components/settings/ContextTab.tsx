"use client";

import { useCallback } from "react";
import type { BranchConfig } from "@/components/settings/BranchSettings";
import { ModelSelector } from "@/components/settings/ModelSelector";
import type { Model } from "@/lib/types";

type Props = {
  config: BranchConfig;
  onUpdate: (patch: Partial<BranchConfig>) => void;
  models: Model[];
  modelsLoading: boolean;
  branchName?: string;
};

export function ContextTab({
  config,
  onUpdate,
  models,
  modelsLoading,
  branchName,
}: Props) {
  const contextMode = config.contextMode ?? "none";

  const handleContextModeChange = useCallback(
    (value: string) => {
      if (value === "none") {
        onUpdate({
          contextMode: "none",
          summarizationTrigger: null,
          summarizationModel: null,
          summarizationEvery: null,
          summarizationRatio: null,
          summarizationKeep: null,
        });
      } else if (value === "sliding-window") {
        onUpdate({
          contextMode: "sliding-window",
          summarizationTrigger: null,
          summarizationModel: null,
          summarizationEvery: null,
          summarizationRatio: null,
          summarizationKeep: null,
        });
      } else if (value === "summarization") {
        onUpdate({
          contextMode: "summarization",
          summarizationTrigger: config.summarizationTrigger ?? "window",
          summarizationEvery: config.summarizationEvery ?? 10,
          summarizationKeep: config.summarizationKeep ?? 4,
        });
      }
    },
    [
      onUpdate,
      config.summarizationTrigger,
      config.summarizationEvery,
      config.summarizationKeep,
    ],
  );

  return (
    <div className="flex flex-col gap-5">
      {branchName && (
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
          Branch: {branchName}
        </p>
      )}

      {/* Context Mode */}
      <div>
        <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Context Mode
        </span>
        <div className="flex gap-4">
          {(["none", "sliding-window", "summarization"] as const).map(
            (value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
              >
                <input
                  type="radio"
                  name="settings-context-mode"
                  value={value}
                  checked={contextMode === value}
                  onChange={() => handleContextModeChange(value)}
                  className="accent-zinc-700 dark:accent-zinc-300"
                />
                {value === "none"
                  ? "None"
                  : value === "sliding-window"
                    ? "Sliding Window"
                    : "Summarization"}
              </label>
            ),
          )}
        </div>
      </div>

      {/* Sliding Window Size */}
      {contextMode === "sliding-window" && (
        <div>
          <label
            htmlFor="ctx-window-size"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Window Size
          </label>
          <input
            id="ctx-window-size"
            type="number"
            min={1}
            value={config.slidingWindowSize}
            onChange={(e) =>
              onUpdate({
                slidingWindowSize: Number.parseInt(e.target.value, 10) || 20,
              })
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      )}

      {/* Summarization Settings */}
      {contextMode === "summarization" && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Summarization
          </span>

          {/* Trigger type */}
          <div className="flex gap-4">
            {(["window", "percentage"] as const).map((trigger) => (
              <label
                key={trigger}
                className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
              >
                <input
                  type="radio"
                  name="settings-summarization-trigger"
                  value={trigger}
                  checked={
                    (config.summarizationTrigger ?? "window") === trigger
                  }
                  onChange={() => onUpdate({ summarizationTrigger: trigger })}
                  className="accent-zinc-700 dark:accent-zinc-300"
                />
                {trigger === "window" ? "Window" : "Percentage"}
              </label>
            ))}
          </div>

          {/* Model */}
          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Model
            </span>
            <ModelSelector
              models={models}
              value={config.summarizationModel ?? ""}
              onChange={(id) => onUpdate({ summarizationModel: id })}
              isLoading={modelsLoading}
            />
          </div>

          {(config.summarizationTrigger ?? "window") === "window" && (
            <div>
              <label
                htmlFor="ctx-sum-every"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Every (messages)
              </label>
              <input
                id="ctx-sum-every"
                type="number"
                min={2}
                value={config.summarizationEvery ?? 10}
                onChange={(e) =>
                  onUpdate({
                    summarizationEvery:
                      Number.parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          )}

          {config.summarizationTrigger === "percentage" && (
            <div>
              <label
                htmlFor="ctx-sum-ratio"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Ratio (%)
              </label>
              <input
                id="ctx-sum-ratio"
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
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="ctx-sum-keep"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Keep (recent messages)
            </label>
            <input
              id="ctx-sum-keep"
              type="number"
              min={0}
              value={config.summarizationKeep ?? 4}
              onChange={(e) =>
                onUpdate({
                  summarizationKeep: Number.parseInt(e.target.value, 10) || 4,
                })
              }
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      )}

      {/* Sticky Facts */}
      <div>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={!!config.stickyFactsEnabled}
            onChange={(e) =>
              onUpdate({
                stickyFactsEnabled: e.target.checked ? 1 : 0,
              })
            }
            className="accent-zinc-700 dark:accent-zinc-300"
          />
          Sticky Facts
        </label>

        {!!config.stickyFactsEnabled && (
          <div className="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <div>
              <label
                htmlFor="ctx-facts-every"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Every (messages)
              </label>
              <input
                id="ctx-facts-every"
                type="number"
                min={1}
                value={config.stickyFactsEvery}
                onChange={(e) =>
                  onUpdate({
                    stickyFactsEvery: Number.parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Model
              </span>
              <ModelSelector
                models={models}
                value={config.stickyFactsModel ?? ""}
                onChange={(id) => onUpdate({ stickyFactsModel: id })}
                isLoading={modelsLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
