import { auth } from '@/app/(auth)/auth';
import { ProjectOverview } from "@/components/project-overview";
import { redirect } from "next/navigation";


export default async function ProjectOverviewPage() {
  const session = await auth();
  console.log(session);
  if (!session) {
    redirect('/api/auth/guest');
  }

  return <ProjectOverview  />;
}