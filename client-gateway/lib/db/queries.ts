import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  message,
  type DBMessage,
  type Chat,
  type Project,
  contextFile,
  project,
  stream,
  excelSqlite,
  type ExcelSqlite
} from './schema';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export { db, project };

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by email');
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);
  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function saveChat({ id, userId, title, visibility, projectId }: { id: string; userId: string; title: string; visibility: VisibilityType; projectId?: string }) {
  console.log('saveChat', id, userId, title, visibility, projectId);
  try {
    const values: any = { id, createdAt: new Date(), userId, title, visibility };
    if (projectId) values.projectId = projectId;
    return await db.insert(chat).values(values);  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id)); // Delete streams before deleting chat
    const [chatsDeleted] = await db.delete(chat).where(eq(chat.id, id)).returning();
    return chatsDeleted;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete chat by id');
  }
}

export async function updateChatById({ id, title }: { id: string; title: string }) {
  try {
    const [updatedChat] = await db
      .update(chat)
      .set({ title })
      .where(eq(chat.id, id))
      .returning();
    
    if (!updatedChat) {
      throw new ChatSDKError('not_found:database', 'Chat not found');
    }
    
    return updatedChat;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:database', 'Failed to update chat');
  }
}

export async function getChatsByUserId({ id, limit, startingAfter, endingBefore }: { id: string; limit: number; startingAfter: string | null; endingBefore: string | null; }) {
  try {
    const extendedLimit = limit + 1;
    const query = (whereCondition?: SQL<any>) =>
      db.select().from(chat).where(whereCondition ? and(whereCondition, eq(chat.userId, id)) : eq(chat.userId, id)).orderBy(desc(chat.createdAt)).limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db.select().from(chat).where(eq(chat.id, startingAfter)).limit(1);
      if (!selectedChat) throw new ChatSDKError('not_found:database', `Chat with id ${startingAfter} not found`);
      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db.select().from(chat).where(eq(chat.id, endingBefore)).limit(1);
      if (!selectedChat) throw new ChatSDKError('not_found:database', `Chat with id ${endingBefore} not found`);
      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    return { chats: hasMore ? filteredChats.slice(0, limit) : filteredChats, hasMore };
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get chats by user id');
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({ messages }: { messages: Array<DBMessage> }) {
  try {
    return await db.insert(message).values(messages);
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.chatId, id)).orderBy(asc(message.createdAt));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get messages by chat id');
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}


export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

export async function updateChatVisiblityById({ chatId, visibility }: { chatId: string; visibility: 'private' | 'public'; }) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update chat visibility by id');
  }
}

export async function getMessageCountByUserId({ id, differenceInHours }: { id: string; differenceInHours: number }) {
  try {
    const since = new Date(Date.now() - differenceInHours * 60 * 60 * 1000);
    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(chat.userId, id), gte(message.createdAt, since), eq(message.role, 'user')))
      .execute();
    return stats?.count ?? 0;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get message count by user id');
  }
}

export async function createProject({ name, userId, visibility, vectorCollection }: { name: string; userId: string; visibility: VisibilityType; vectorCollection: string }): Promise<Project[]> {
  try {
    return await db.insert(project).values({ id: crypto.randomUUID(), name, userId, visibility, vectorCollection, isIndexed: false, createdAt: new Date() }).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create project');
  }
}

export async function getProjectsByUserId({ userId }: { userId: string }) {
  try {
    return await db.select().from(project).where(eq(project.userId, userId)).orderBy(desc(project.createdAt));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get projects');
  }
}

export async function deleteProjectById({ id }: { id: string }) {
  try {
    // Delete in correct order to respect foreign key constraints
    // 1. Delete messages for all chats in this project
    const chats = await db.select({ id: chat.id }).from(chat).where(eq(chat.projectId, id));
    for (const chatRecord of chats) {
      await db.delete(message).where(eq(message.chatId, chatRecord.id));
      await db.delete(stream).where(eq(stream.chatId, chatRecord.id));
    }
    
    // 2. Delete chats for this project
    await db.delete(chat).where(eq(chat.projectId, id));
    
    // 3. Delete Excel SQLite records and clean up database files
    const excelRecords = await getExcelSqliteByProjectId({ projectId: id });
    for (const record of excelRecords) {
      const { cleanupDatabase } = await import('../excel/sqlite');
      cleanupDatabase(record.dbPath);
    }
    await deleteExcelSqliteByProjectId({ projectId: id });
    
    // 4. Delete context files for this project
    await db.delete(contextFile).where(eq(contextFile.projectId, id));
    
    // 5. Finally delete the project
    return await db.delete(project).where(eq(project.id, id)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete project');
  }
}

export async function getProjectById({ id }: { id: string }) {
  try {
    const [selectedProject] = await db.select().from(project).where(eq(project.id, id));
    return selectedProject;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get project by id');
  }
}


export async function createContextFile({ projectId, fileName, mimeType, fileSize, embedded, chunkCount, indexingStatus }: { projectId: string; fileName: string; mimeType: string; fileSize: number; embedded?: boolean; chunkCount?: number; indexingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'completedWithoutData' }) {
  try {
    return await db.insert(contextFile).values({ id: crypto.randomUUID(), projectId, fileName, mimeType, fileSize, embedded: embedded ?? false, chunkCount, indexingStatus: indexingStatus ?? 'pending', createdAt: new Date() }).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create context file');
  }
}

export async function getContextFilesByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db.select().from(contextFile).where(eq(contextFile.projectId, projectId)).orderBy(desc(contextFile.createdAt));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get context files');
  }
}

export async function deleteContextFileById({ id }: { id: string }) {
  try {
    // First delete any ExcelSqlite records that reference this context file
    await db.delete(excelSqlite).where(eq(excelSqlite.contextFileId, id));
    
    // Then delete the context file
    return await db.delete(contextFile).where(eq(contextFile.id, id)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete context file');
  }
}

export async function updateProjectIndexingStatus({ id, isIndexed }: { id: string; isIndexed: boolean }) {
  try {
    return await db.update(project).set({ isIndexed }).where(eq(project.id, id)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update project indexing status');
  }
}

export async function updateContextFileIndexingStatus({ id, indexingStatus }: { id: string; indexingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'completedWithoutData' }) {
  try {
    return await db.update(contextFile).set({ indexingStatus }).where(eq(contextFile.id, id)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update context file indexing status');
  }
}

export async function updateContextFileChunkCount({ id, chunkCount }: { id: string; chunkCount: number }) {
  try {
    return await db.update(contextFile).set({ chunkCount }).where(eq(contextFile.id, id)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update context file chunk count');
  }
}

// Excel SQLite functions
export async function createExcelSqlite({ projectId, contextFileId, dbPath, tables, fileName }: { projectId: string; contextFileId: string; dbPath: string; tables: any[]; fileName: string }) {
  try {
    return await db.insert(excelSqlite).values({ 
      id: crypto.randomUUID(), 
      projectId, 
      contextFileId, 
      dbPath, 
      tables, 
      fileName, 
      createdAt: new Date() 
    }).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create Excel SQLite record');
  }
}

export async function getExcelSqliteByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db.select().from(excelSqlite).where(eq(excelSqlite.projectId, projectId));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get Excel SQLite records');
  }
}

export async function deleteExcelSqliteByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db.delete(excelSqlite).where(eq(excelSqlite.projectId, projectId)).returning();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete Excel SQLite records');
  }
}