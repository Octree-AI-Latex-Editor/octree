'use client';

import { usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

interface ProjectBreadcrumbsProps {
  projectTitle: string;
}

export function ProjectBreadcrumbs({ projectTitle }: ProjectBreadcrumbsProps) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params?.projectId as string;

  const [fileName, setFileName] = useState<string | null>(null);

  // Check if we're in a file editor
  const isFileEditor =
    pathname.includes('/files/') && pathname.includes('/editor');

  // Extract file ID from pathname
  const fileId = isFileEditor
    ? pathname.split('/files/')[1]?.split('/')[0]
    : null;

  useEffect(() => {
    const fetchFileName = async () => {
      if (!fileId || !projectId) {
        setFileName(null);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from('files' as const)
        .select('name')
        .eq('id', fileId)
        .eq('project_id', projectId)
        .single<{ name: string }>();

      setFileName(data?.name || null);
    };

    fetchFileName();
  }, [fileId, projectId]);

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1 text-sm">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {isFileEditor ? (
            <BreadcrumbLink href={`/projects/${projectId}`}>
              {projectTitle}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{projectTitle}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {isFileEditor && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {fileName ? (
                <BreadcrumbPage>{fileName}</BreadcrumbPage>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
