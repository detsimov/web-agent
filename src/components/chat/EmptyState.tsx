export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Start a conversation
      </h2>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Type a message below to begin chatting with the AI. You can change the
        model and token limit in the header.
      </p>
    </div>
  );
}
