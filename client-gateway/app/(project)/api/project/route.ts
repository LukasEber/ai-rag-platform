import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { getProjectsByUserId, createProject, getProjectById, getContextFilesByProjectId, db, project as projectTable, deleteContextFileById, deleteProjectById, createContextFile } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import {  deleteProjectVectorCollection, ingestFilesToProject } from '@/lib/vector/query';
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
    console.log('ingesting files to project', files);
    await ingestFilesToProject(files, project.id);

    return Response.json(project);
  } catch (e) {
    console.error('Error in POST /project', e);
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

  await ingestFilesToProject(files, id);

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
