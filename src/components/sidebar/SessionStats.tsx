"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChatMessage } from "@/lib/types";

type Pricing = {
  prompt: string;
  completion: string;
};

type Props = {
  messages: ChatMessage[];
  contextLength: number;
  pricing?: Pricing | null;
};

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function pressureColor(ratio: number): string {
  if (ratio > 0.75) return "bg-red-500";
  if (ratio > 0.5) return "bg-orange-500";
  if (ratio > 0.25) return "bg-amber-500";
  return "bg-emerald-500";
}

type SparklinePoint = {
  turn: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
};

export function SessionStats({ messages, contextLength, pricing }: Props) {
  const {
    totalInput,
    totalOutput,
    totalCost,
    turnCount,
    lastContextUsed,
    sparkline,
  } = useMemo(() => {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    let turnCount = 0;
    let lastContextUsed = 0;
    const sparkline: SparklinePoint[] = [];

    for (const msg of messages) {
      if (msg.usage) {
        turnCount++;
        totalInput += msg.usage.inputTokens;
        totalOutput += msg.usage.outputTokens;
        totalCost += msg.usage.cost ?? 0;
        lastContextUsed =
          msg.usage.inputTokens + msg.usage.outputTokens;
        sparkline.push({
          turn: turnCount,
          cost: msg.usage.cost ?? 0,
          inputTokens: msg.usage.inputTokens,
          outputTokens: msg.usage.outputTokens,
        });
      }
    }

    return {
      totalInput,
      totalOutput,
      totalCost,
      turnCount,
      lastContextUsed,
      sparkline,
    };
  }, [messages]);

  const hasData = turnCount > 0;
  const pressure = hasData ? lastContextUsed / contextLength : 0;

  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-700">
      {/* Context pressure */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Context</span>
          <span>
            {hasData
              ? `${formatTokens(lastContextUsed)} / ${formatTokens(contextLength)} tokens`
              : "No active chat"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          {hasData && (
            <div
              className={`h-full rounded-full transition-all ${pressureColor(pressure)}`}
              style={{ width: `${Math.min(pressure * 100, 100)}%` }}
            />
          )}
        </div>
        {hasData && (
          <div className="mt-0.5 text-right text-[10px] text-zinc-400 dark:text-zinc-500">
            {Math.round(pressure * 100)}%
          </div>
        )}
      </div>

      {/* Cumulative totals */}
      {hasData && (() => {
        const promptRate = Number.parseFloat(pricing?.prompt ?? "0");
        const completionRate = Number.parseFloat(pricing?.completion ?? "0");
        const inputCost = promptRate ? totalInput * promptRate : null;
        const outputCost = completionRate ? totalOutput * completionRate : null;

        return (
          <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div className="text-zinc-500 dark:text-zinc-400">
              <span className="text-zinc-400 dark:text-zinc-500">&darr;</span>{" "}
              {formatTokens(totalInput)} in
            </div>
            <div className="text-right text-zinc-500 dark:text-zinc-400">
              {inputCost != null ? `$${inputCost.toFixed(4)}` : ""}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              <span className="text-zinc-400 dark:text-zinc-500">&uarr;</span>{" "}
              {formatTokens(totalOutput)} out
            </div>
            <div className="text-right text-zinc-500 dark:text-zinc-400">
              {outputCost != null ? `$${outputCost.toFixed(4)}` : ""}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              {turnCount} {turnCount === 1 ? "turn" : "turns"}
            </div>
            <div className="text-right font-medium text-zinc-600 dark:text-zinc-300">
              ${totalCost.toFixed(4)}
            </div>
          </div>
        );
      })()}

      {/* Cost-per-turn sparkline */}
      {sparkline.length >= 2 && (
        <div className="mt-1">
          <div className="mb-1 text-[10px] text-zinc-400 dark:text-zinc-500">
            Cost per turn
          </div>
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart
              data={sparkline}
              margin={{ top: 2, right: 2, bottom: 0, left: 2 }}
            >
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#costGradient)"
                dot={false}
                activeDot={{ r: 3, fill: "#10b981" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as SparklinePoint;
                  return (
                    <div className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="font-medium text-zinc-700 dark:text-zinc-200">
                        Turn {d.turn}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        ${d.cost.toFixed(4)}
                      </div>
                      <div className="text-zinc-400 dark:text-zinc-500">
                        {formatTokens(d.inputTokens)} in /{" "}
                        {formatTokens(d.outputTokens)} out
                      </div>
                    </div>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
