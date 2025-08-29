import { auth } from '@/app/(auth)/auth';
import { getChatById, updateChatById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const chat = await getChatById({ id });
    if (!chat) {
      return new ChatSDKError('not_found:chat').toResponse();
    }

    // Check if user owns the chat
    if (chat.userId !== session.user.id) {
      return new ChatSDKError('forbidden:chat').toResponse();
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new ChatSDKError('bad_request:api', 'Title is required').toResponse();
    }

    if (title.length > 100) {
      return new ChatSDKError('bad_request:api', 'Title must be less than 100 characters').toResponse();
    }

    const updatedChat = await updateChatById({
      id,
      title: title.trim(),
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error('Error updating chat:', error);
    return new ChatSDKError('internal_server_error:api').toResponse();
  }
}
