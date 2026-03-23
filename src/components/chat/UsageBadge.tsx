type Props = {
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export function UsageBadge({ usage }: Props) {
  return (
    <span className="inline-flex gap-2 text-xs text-zinc-400 dark:text-zinc-500">
      <span>{usage.promptTokens} in</span>
      <span>&middot;</span>
      <span>{usage.completionTokens} out</span>
      <span>&middot;</span>
      <span>{usage.totalTokens} total</span>
    </span>
  );
}
