import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { getProjectsByUserId, createProject, getProjectById, getContextFilesByProjectId, db, project as projectTable, deleteContextFileById, deleteProjectById, createContextFile } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { upsertProjectChunk, deleteProjectVectorCollection } from '@/lib/vector/query';
import type { VisibilityType } from '@/components/visibility-selector';
import type { Project } from '@/lib/db/schema';
import pdfParse from 'pdf-parse'; 
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

export const config = { api: { bodyParser: false } };

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  visibility: z.enum(['private', 'public']).default('private'),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:project').toResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      // Fetch single project and its files
      const project = await getProjectById({ id });
      if (!project || project.userId !== session.user.id) {
        return new ChatSDKError('not_found:project').toResponse();
      }
      const files = await getContextFilesByProjectId({ projectId: id });
      return Response.json({ ...project, files });
    } else {
      // Fetch all projects for user
      const projects = await getProjectsByUserId({ userId: session.user.id });
      return Response.json(projects);
    }
  } catch (e) {
    return new ChatSDKError('bad_request:api').toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:project').toResponse();
  }

  let name: string = '';
  let visibility: VisibilityType = 'private';
  let files: File[] = [];

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    name = (form.get('name') as string) || '';
    visibility = (form.get('visibility') as VisibilityType) || 'private';
    files = form.getAll('files') as File[];
  } else {
    try {
      const body = await request.json();
      const parsed = createProjectSchema.parse(body);
      name = parsed.name;
      visibility = parsed.visibility;
    } catch {
      return new ChatSDKError('bad_request:api', 'Invalid request body').toResponse();
    }
  }

  if (!name) {
    return new ChatSDKError('bad_request:api', 'Project name is required').toResponse();
  }

  const vectorCollection = `project_${crypto.randomUUID()}`;

  try {
    const result = await createProject({
      name,
      userId: session.user.id,
      visibility,
      vectorCollection,
    });
    // drizzle returns an array of inserted rows
    const project: Project | undefined = Array.isArray(result) ? result[0] : result;

    if (!project) {
      return new ChatSDKError('bad_request:api', 'Failed to create project, project did not exist').toResponse();
    }
    for (const file of files) {
      if (file && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        let text = '';
        if (file.type === 'application/pdf') {
          const { text: txt } = await pdfParse(buf);
          text = txt;
        } else {
          text = buf.toString('utf-8');
        }
        if (!text || text.trim() === '') {
          console.warn('[Ingestion] No text extracted from file.');
        }
        const CHUNK_SIZE = 8000;
        const OVERLAP = 2000;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
          chunks.push(text.slice(i, i + CHUNK_SIZE));
        }
        for (let idx = 0; idx < chunks.length; idx++) {
          await upsertProjectChunk(project.id, chunks[idx], { chunkIndex: idx });
        }
        await createContextFile({
          projectId: project.id,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          embedded: false,
          chunkCount: chunks.length,
        });
      }
    }
    return Response.json(project);
  } catch (e) {
    return new ChatSDKError('bad_request:api', 'File upload failed').toResponse();
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:project').toResponse();
  }
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new ChatSDKError('bad_request:api', 'PATCH must use multipart/form-data').toResponse();
  }
  const form = await request.formData();
  const id = form.get('id') as string;
  if (!id) {
    return new ChatSDKError('bad_request:api', 'Project id is required').toResponse();
  }
  const project = await getProjectById({ id });
  if (!project || project.userId !== session.user.id) {
    return new ChatSDKError('not_found:project').toResponse();
  }
  const name = form.get('name') as string;
  const visibility = (form.get('visibility') as VisibilityType) || 'private';
  // Update project fields
  await db.update(projectTable)
    .set({ name, visibility })
    .where(eq(projectTable.id, id));
  // Handle new files
  const files = form.getAll('files') as File[];
  for (const file of files) {
    if (file && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      let text = '';
      if (file.type === 'application/pdf') {
        const { text: txt } = await pdfParse(buf);
        text = txt;
      } else {
        text = buf.toString('utf-8');
      }
      const CHUNK_SIZE = 1000;
      const OVERLAP = 200;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }
      for (let idx = 0; idx < chunks.length; idx++) {
        await upsertProjectChunk(id, chunks[idx], { chunkIndex: idx });
      }
      // Save file metadata
      await createContextFile({
        projectId: id,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        embedded: false,
        chunkCount: chunks.length,
      });
    }
  }
  // Return updated project and files
  const updatedProject = await getProjectById({ id });
  const updatedFiles = await getContextFilesByProjectId({ projectId: id });
  return Response.json({ ...updatedProject, files: updatedFiles });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:project').toResponse();
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return new ChatSDKError('bad_request:api', 'Project id is required').toResponse();
  }
  const project = await getProjectById({ id });
  if (!project || project.userId !== session.user.id) {
    return new ChatSDKError('not_found:project').toResponse();
  }
  const fileId = searchParams.get('fileId');
  if (fileId) {
    // Delete a file from a project
    const files = await getContextFilesByProjectId({ projectId: id });
    const file = files.find(f => f.id === fileId);
    if (!file) {
      return new ChatSDKError('not_found:document').toResponse();
    }
    await deleteContextFileById({ id: fileId });
    return Response.json({ success: true });
  }
  // Delete the vector collection associated with the project
  await deleteProjectVectorCollection(id);
  await deleteProjectById({ id });

  return Response.json({ success: true });
}
