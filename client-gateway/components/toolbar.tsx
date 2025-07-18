import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { StopIcon } from "./icons";

export function ChatToolbar({
  status,
  stop,
}: {
  status: UseChatHelpers<ChatMessage>['status'];
  stop: UseChatHelpers<ChatMessage>['stop'];
}) {
  if (status !== 'streaming') return null;

  return (
    <div className="absolute right-6 bottom-6 p-2 border rounded-full shadow-lg bg-background cursor-pointer">
      <button onClick={stop}>
        <StopIcon />
      </button>
    </div>
  );
}
