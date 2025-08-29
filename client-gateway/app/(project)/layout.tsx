import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { auth } from '@/app/(auth)/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  // Check if user is authenticated and session is valid
  if (!session?.user?.id) {
    // Clear any invalid session cookies and redirect
    redirect('/login');
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster position="top-center" />
      <SidebarProvider defaultOpen={true}>
        <AppSidebar user={session?.user} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
