import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white dark:bg-zinc-900">
      <ChatContainer />
    </div>
  );
}
