import type React from 'react';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/projects/back-button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { headers } from 'next/headers';

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

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isFileEditor =
    pathname.includes('/files/') && pathname.includes('/editor');

  let fileId = null;
  if (isFileEditor) {
    const pathParts = pathname.split('/');
    const fileIndex = pathParts.findIndex((part) => part === 'files');
    if (fileIndex !== -1 && pathParts[fileIndex + 1]) {
      fileId = pathParts[fileIndex + 1];
    }
  }

  let file = null;
  if (fileId) {
    const { data: fileData } = await supabase
      .from('files' as const)
      .select('name')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single<{ name: string }>();
    file = fileData;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar userName={userName} projectId={projectId} />
      <SidebarInset>
        <header className="relative flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-muted-foreground">|</span>
            <BackButton />
          </div>

          <div className="absolute left-1/2 flex flex-1 -translate-x-1/2 justify-center">
            <Breadcrumb>
              <BreadcrumbList className="gap-1 text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isFileEditor ? (
                    <BreadcrumbLink href={`/projects/${projectId}`}>
                      {project?.title || 'Project'}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>
                      {project?.title || 'Project'}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {isFileEditor && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{file?.name || 'File'}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
