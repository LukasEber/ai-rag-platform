import { auth } from '@/app/(auth)/auth';
import { getProjectById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { ingestFilesToProjectWithStatus } from '@/lib/vector/query';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId') as string;

    if (!projectId) {
      return new ChatSDKError('bad_request:api', 'Project ID is required').toResponse();
    }

    if (!files || files.length === 0) {
      return new ChatSDKError('bad_request:api', 'No files provided').toResponse();
    }

    // Verify project exists and user has access
    const project = await getProjectById({ id: projectId });
    if (!project) {
      return new ChatSDKError('not_found:project', 'Project not found').toResponse();
    }

    if (project.userId !== session.user.id) {
      return new ChatSDKError('forbidden:project', 'Access denied').toResponse();
    }

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      return new ChatSDKError('bad_request:api', 'Invalid file type(s) provided').toResponse();
    }

    // Validate file sizes (50MB limit per file)
    const maxSize = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      return new ChatSDKError('bad_request:api', 'File(s) too large (max 50MB per file)').toResponse();
    }

    // Start async indexing
    ingestFilesToProjectWithStatus(files, projectId);

    return NextResponse.json({ 
      success: true, 
      message: `${files.length} file(s) uploaded successfully. Indexing in progress...`,
      projectId 
    });

  } catch (error) {
    console.error('Error uploading files:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError('internal_server_error:api').toResponse();
  }
}
