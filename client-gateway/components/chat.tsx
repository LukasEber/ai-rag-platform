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
  
  // Get current project to check indexing status
  const currentProject = projects.find(p => p.id === chatProjectIdRef.current);
  const isProjectIndexing = currentProject && !currentProject.isIndexed;

  // Optimistic update: if we just uploaded files, assume indexing started
  const [optimisticIndexing, setOptimisticIndexing] = useState(false);
  
  // Listen for upload completion to set optimistic indexing
  useEffect(() => {
    const handleUploadComplete = () => {
      setOptimisticIndexing(true);
      // Reset optimistic state after 10 seconds
      setTimeout(() => setOptimisticIndexing(false), 10000);
    };

    window.addEventListener('upload-complete', handleUploadComplete);
    return () => window.removeEventListener('upload-complete', handleUploadComplete);
  }, []);

  // Show indexing state if either optimistic or actual
  const showIndexingState = isProjectIndexing || optimisticIndexing;

  // Poll for project status updates when we have a projectId
  useEffect(() => {
    if (!chatProjectIdRef.current) return;

    // Initial fetch immediately
    fetchProjects();

    // Then poll every 2 seconds for faster updates
    const pollInterval = setInterval(() => {
      fetchProjects();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [chatProjectIdRef.current, fetchProjects]);

  // Determine if this is a new chat (no projectId assigned)
  useEffect(() => {
    // Always fetch projects immediately when component mounts
    fetchProjects();
    
    // Only show project dialog for new chats (on /chat, not /chat/[id])
    if ((pathname === '/chat') && (!chatProjectIdRef.current || chatProjectIdRef.current === '')) {
      setShowProjectDialog(true);
    }
  }, [chatProjectIdRef.current, fetchProjects, pathname]);

  // Prevent sending messages if no project is selected for new chats
  const canSendMessage = chatProjectIdRef.current && chatProjectIdRef.current !== '';

  // Assign project to chat: just set state, no API call
  const assignProjectToChat = (projectId: string) => {
    console.log('assignProjectToChat', projectId);
    setPersisting(true);
    chatProjectIdRef.current = projectId;
    setShowProjectDialog(false);
    setPersisting(false);
  };

  // Update chatProjectId when projectId prop changes (e.g., after chat creation)
  useEffect(() => {
    if (projectId && projectId !== chatProjectIdRef.current) {
      chatProjectIdRef.current = projectId;
    }
  }, [projectId, chatProjectIdRef.current]);

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
         const requestBody = {
           id,
           message: messages.at(-1),
           selectedChatModel: initialChatModel,
           selectedVisibilityType: visibilityType,
           projectId: chatProjectIdRef.current,
           ...body,
         };
         
         console.log('[CHAT DEBUG] prepareSendMessagesRequest:', {
           id,
           chatProjectId: chatProjectIdRef.current,
           projectId: requestBody.projectId,
           messageId: requestBody.message?.id,
           messageRole: requestBody.message?.role,
           messageParts: requestBody.message?.parts,
           selectedChatModel: requestBody.selectedChatModel,
           selectedVisibilityType: requestBody.selectedVisibilityType,
           bodyKeys: Object.keys(body || {}),
           fullRequestBody: requestBody
         });
         
         return { body: requestBody };
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
    if (query && !hasAppendedQuery && canSendMessage) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id, canSendMessage]);

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
                  {projects.map((project) => {
                    const isIndexed = project.isIndexed;
                    const isDisabled = !isIndexed || persisting;
                    
                    return (
                      <li key={project.id}>
                        <button
                          className={`w-full text-left px-4 py-2 rounded transition ${
                            isDisabled 
                              ? 'opacity-50 cursor-not-allowed bg-muted' 
                              : 'hover:bg-muted'
                          } ${chatProjectIdRef.current === project.id ? 'bg-primary text-primary-foreground' : ''}`}
                          disabled={isDisabled}
                          onClick={() => {
                            if (!isDisabled) {
                              console.log('project.id', project.id);
                              assignProjectToChat(project.id)
                            }
                          }}
                          title={!isIndexed ? 'Not ready yet - indexing in progress' : undefined}
                        >
                          <span className="font-semibold">{project.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {project.visibility}
                            {!isIndexed && ' • Indexing...'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
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
          projectId={chatProjectIdRef.current}
        />

        <Messages
          chatId={id}
          status={status}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
        />

                          {showIndexingState ? (
           <div className="flex items-center justify-center p-8 text-center">
             <div className="max-w-md">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4"></div>
               <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                 Project is being indexed
               </h3>
               <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                 Please wait while the documents are being processed. You can chat once indexing is complete.
               </p>
               {optimisticIndexing && !isProjectIndexing && (
                 <p className="text-xs text-gray-500 dark:text-gray-500">
                   Status update in progress...
                 </p>
               )}
             </div>
           </div>
                 ) : (
           <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
             {!isReadonly && canSendMessage && (
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
             {!isReadonly && !canSendMessage && (
               <div className="flex items-center justify-center w-full p-4 text-center">
                 <p className="text-sm text-gray-600 dark:text-gray-400">
                   Please select a project to start chatting
                 </p>
               </div>
             )}
           </form>
         )}
      </div>
    </>
  );
}
