import { auth } from '@/app/(auth)/auth';
import { getProjectsByUserId, getProjectById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:project').toResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (projectId) {
      // Get specific project status
      const project = await getProjectById({ id: projectId });
      if (!project || project.userId !== session.user.id) {
        return new ChatSDKError('not_found:project').toResponse();
      }
      return Response.json({ 
        projectId, 
        isIndexed: project.isIndexed 
      });
    } else {
      // Get all projects status for user
      const projects = await getProjectsByUserId({ userId: session.user.id });
      return Response.json(projects.map(project => ({
        projectId: project.id,
        name: project.name,
        isIndexed: project.isIndexed
      })));
    }
  } catch (e) {
    console.error('Error in GET /project/indexing-status', e);
    return new ChatSDKError('bad_request:api').toResponse();
  }
} 