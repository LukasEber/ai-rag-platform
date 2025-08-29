import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { queryProjectChunks } from '@/lib/vector/query';
import { getStreamContext } from '@/lib/db/utils';
import { intelligentDataAgent } from '@/lib/excel/agent';
import { hasExcelFiles, analyzeProjectDataSources } from '@/lib/excel/detection';

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  let json: any;

  try {
    json = await request.json();
    console.log('[API DEBUG] Raw JSON received:', json);
    requestBody = postRequestBodySchema.parse(json);
    console.log('[API DEBUG] Parsed requestBody:', requestBody);
  } catch (error) {
    console.error('[API DEBUG] Schema validation failed:', error);
    console.error('[API DEBUG] Raw JSON that failed:', json);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      projectId,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      projectId?: string;
    } = requestBody;

    console.log('[API DEBUG] Extracted projectId:', {
      projectId,
      projectIdType: typeof projectId,
      projectIdLength: projectId?.length,
      projectIdTrimmed: projectId?.trim(),
      isEmpty: projectId?.trim() === ''
    });

    // Validate projectId if provided
    if (projectId && projectId.trim() === '') {
      console.error('[API DEBUG] Invalid projectId detected:', projectId);
      return new ChatSDKError('bad_request:api', 'Invalid projectId provided').toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      console.log('[API DEBUG] Creating new chat:', {
        chat,
        projectId,
        selectedVisibilityType,
        title,
        id,
        userId: session.user.id,
        projectIdForSave: projectId || undefined
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
        projectId: projectId || undefined,
      });
      
      console.log('[API DEBUG] Chat created successfully');
    } else {
      console.log('[API DEBUG] Chat already exists:', {
        chatId: chat.id,
        chatProjectId: chat.projectId,
        chatUserId: chat.userId,
        requestProjectId: projectId
      });
      
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let contextText = '';
    let agentMetadata: any = {};

    if (projectId && projectId.trim() !== '') {
      const userQuestion = message.parts.map((p: any) => p.text).join(' ');
      
      console.log(`[TEST] Processing chat request`, {
        projectId,
        userQuestion: userQuestion.substring(0, 100),
        questionLength: userQuestion.length
      });
      
      // Step 1: Quick check if project has Excel files
      const hasExcel = await hasExcelFiles(projectId);
      
      console.log(`[TEST] Excel check result`, { projectId, hasExcel });
      
      if (hasExcel) {
        // Step 2: Detailed analysis of data sources
        const dataSourceAnalysis = await analyzeProjectDataSources(projectId);
        
        console.log(`[TEST] Data source analysis result`, {
          projectId,
          shouldUseAgent: dataSourceAnalysis.shouldUseAgent,
          excelFileCount: dataSourceAnalysis.excelFiles.length,
          totalFileCount: dataSourceAnalysis.totalFiles
        });
        
        if (dataSourceAnalysis.shouldUseAgent) {
          // Use intelligent agent for Excel + other files
          console.log(`[TEST] Using intelligent agent for project ${projectId}`);
          const agentResult = await intelligentDataAgent(userQuestion, projectId);
          
          contextText = agentResult.context;
          agentMetadata = agentResult.metadata;
          
          // Add agent decision info to context for better LLM understanding
          if (agentResult.decision) {
            const decisionInfo = `[Agent Decision: ${agentResult.decision.selectedSource.type} (confidence: ${agentResult.decision.selectedSource.confidence})]\n`;
            contextText = decisionInfo + contextText;
          }
          
          console.log(`[TEST] Agent execution completed`, {
            projectId,
            mode: agentResult.mode,
            contextLength: contextText.length,
            metadata: agentMetadata,
            iterations: agentResult.metadata?.totalIterations || 1,
            confidence: agentResult.metadata?.confidence || 'unknown'
          });
        } else {
          // Excel files exist but agent not needed (fallback to vector search)
          console.log(`[TEST] Excel files exist but using vector search only for project ${projectId}`);
          const relevantChunks = await queryProjectChunks(projectId, userQuestion);
          contextText = relevantChunks.map(c => c.text).join('\n\n');
          agentMetadata = { source: 'vector-search-only' };
          
          console.log(`[TEST] Vector search completed`, {
            projectId,
            chunkCount: relevantChunks.length,
            contextLength: contextText.length
          });
        }
      } else {
        // No Excel files - use standard vector search
        console.log(`[TEST] No Excel files, using standard vector search for project ${projectId}`);
        const relevantChunks = await queryProjectChunks(projectId, userQuestion);
        contextText = relevantChunks.map(c => c.text).join('\n\n');
        agentMetadata = { source: 'vector-search-only' };
        
        console.log(`[TEST] Standard vector search completed`, {
          projectId,
          chunkCount: relevantChunks.length,
          contextLength: contextText.length
        });
      }
    }

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, context: contextText }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Unhandled error in POST /chat', error);
    return new ChatSDKError('internal_server_error:api').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
