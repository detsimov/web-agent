type Props = {
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number | null;
  };
};

export function UsageBadge({ usage }: Props) {
  return (
    <span className="inline-flex gap-2 text-xs text-zinc-400 dark:text-zinc-500">
      <span>{usage.inputTokens} in</span>
      <span>&middot;</span>
      <span>{usage.outputTokens} out</span>
      <span>&middot;</span>
      <span>{usage.totalTokens} total</span>
      {usage.cost != null && (
        <>
          <span>&middot;</span>
          <span>${usage.cost.toFixed(4)}</span>
        </>
      )}
    </span>
  );
}
