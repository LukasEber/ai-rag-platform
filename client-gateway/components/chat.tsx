"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { ChatHeader } from "@/components/chat-header";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import type { VisibilityType } from "./visibility-selector";
import { unstable_serialize } from "swr/infinite";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { Session } from "next-auth";
import { useSearchParams } from "next/navigation";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useProjects } from '@/hooks/use-projects';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { usePathname } from 'next/navigation';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  projectId,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
  projectId: string;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const [input, setInput] = useState<string>("");
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const chatProjectIdRef = useRef<string>(projectId);
  const { projects, fetchProjects, loading: projectsLoading } = useProjects();
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const pathname = usePathname();

  // Determine if this is a new chat (no projectId assigned)
  useEffect(() => {
    // Only show project dialog for new chats (on /chat, not /chat/[id])
    if ((pathname === '/chat') && (!chatProjectIdRef.current || chatProjectIdRef.current === '')) {
      setShowProjectDialog(true);
      fetchProjects();
    }
  }, [chatProjectIdRef, fetchProjects, pathname]);

  // Assign project to chat: just set state, no API call
  const assignProjectToChat = (projectId: string) => {
    console.log('assignProjectToChat', projectId);
    setPersisting(true);
    chatProjectIdRef.current = projectId;
    setShowProjectDialog(false);
    setPersisting(false);
  };

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            projectId: chatProjectIdRef.current,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds: any) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: "error",
          description: error.message,
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      {/* Project selection dialog for new chats */}
      <AlertDialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select a Project for this Chat</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            {projectsLoading ? (
              <div>Loading projects...</div>
            ) : (
              projects.length === 0 ? (
                <div>No projects found. Please create a project first.</div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        className={`w-full text-left px-4 py-2 rounded hover:bg-muted transition ${chatProjectIdRef.current === project.id ? 'bg-primary text-primary-foreground' : ''}`}
                        disabled={persisting}
                        onClick={() => {
                          console.log('project.id', project.id);
                          assignProjectToChat(project.id)
                        }}
                      >
                        <span className="font-semibold">{project.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{project.visibility}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
            />
          )}
        </form>
      </div>
    </>
  );
}
