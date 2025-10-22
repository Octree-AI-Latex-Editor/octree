import type React from 'react';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/projects/back-button';
import { ProjectBreadcrumbs } from '@/components/projects/project-breadcrumbs';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName = user?.user_metadata?.name ?? user?.email ?? null;

  const { data: project } = await supabase
    .from('projects' as const)
    .select('title')
    .eq('id', projectId)
    .eq('user_id', user?.id || '')
    .single<{ title: string }>();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar userName={userName} projectId={projectId} />
      <SidebarInset>
        <header className="relative flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-neutral-300">|</span>
            <BackButton />
          </div>

          <div className="absolute left-1/2 flex flex-1 -translate-x-1/2 justify-center">
            <ProjectBreadcrumbs projectTitle={project?.title || 'Project'} />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
