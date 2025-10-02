'use client';

import {
  Folder,
  FileText,
  ChevronDown,
  DonutIcon as DocumentIcon,
  FolderOpen,
  MoreHorizontal,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useProjectRefresh } from '@/app/context/project';
import { AddFileDialog } from '@/components/projects/add-file-dialog';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameFileDialog } from '@/components/projects/rename-file-dialog';

interface Project {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
}

interface File {
  id: string;
  name: string;
  project_id: string;
  size: number | null;
  type: string | null;
  uploaded_at: string | null;
}

interface ProjectWithFiles extends Project {
  files: File[];
}

interface AppSidebarProps {
  userName: string | null;
  projectId?: string;
}

export function AppSidebar({ userName, projectId }: AppSidebarProps) {
  const [currentProject, setCurrentProject] = useState<ProjectWithFiles | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectOpen, setIsProjectOpen] = useState(true);
  const { refreshTrigger } = useProjectRefresh();

  const pathname = usePathname();

  const fetchCurrentProjectAndFiles = useCallback(async () => {
    if (!projectId) return;

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        return;
      }

      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (filesError) {
        console.error(
          'Error fetching files for project:',
          projectId,
          filesError
        );
        return;
      }

      setCurrentProject({
        ...projectData,
        files: filesData || [],
      });
    } catch (error) {
      console.error('Error fetching project and files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCurrentProjectAndFiles();
  }, [refreshTrigger, projectId, fetchCurrentProjectAndFiles]);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <DocumentIcon className="h-4 w-4 text-red-500" />;
      case 'doc':
      case 'docx':
        return <DocumentIcon className="h-4 w-4 text-blue-500" />;
      case 'txt':
        return <FileText className="h-4 w-4 text-gray-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Sidebar className="border-r border-gray-200">
      <SidebarContent className="p-2">
        <SidebarGroup>
          <p className="px-3 pb-1 text-sm font-medium">Files</p>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="p-6 text-center">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                    <div className="h-3 w-1/2 rounded bg-gray-200"></div>
                    <div className="h-3 w-2/3 rounded bg-gray-200"></div>
                  </div>
                </div>
              ) : !currentProject ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  <Folder className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  No project found
                </div>
              ) : (
                <Collapsible
                  open={isProjectOpen}
                  onOpenChange={setIsProjectOpen}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="group w-full justify-between rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          {isProjectOpen ? (
                            <FolderOpen className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Folder className="h-5 w-5 text-gray-500" />
                          )}
                          <span className="truncate font-medium text-gray-900">
                            {currentProject.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-400 transition-transform ${isProjectOpen ? 'rotate-180' : ''}`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>

                  <CollapsibleContent>
                    <SidebarMenuSub className="mt-1 ml-4 space-y-1">
                      {currentProject.files &&
                      currentProject.files.length > 0 ? (
                        <>
                          {currentProject.files.map((file) => {
                            const isActive =
                              pathname ===
                              `/projects/${currentProject.id}/files/${file.id}/editor`;
                            return (
                              <SidebarMenuItem key={file.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isActive}
                                  className={`transition-all duration-200 ${
                                    isActive
                                      ? 'border border-blue-500 bg-blue-50 text-blue-700'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex w-full items-center gap-2">
                                    <Link
                                      href={`/projects/${currentProject.id}/files/${file.id}/editor`}
                                      className="flex flex-1 items-center gap-3 overflow-hidden px-1 py-1"
                                    >
                                      {getFileIcon(file.name)}
                                      <div className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                          {file.name}
                                        </span>
                                      </div>
                                    </Link>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                          aria-label={`Open options for ${file.name}`}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <RenameFileDialog
                                          projectId={currentProject.id}
                                          fileId={file.id}
                                          currentName={file.name}
                                          onRenamed={() => fetchCurrentProjectAndFiles()}
                                        />
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </SidebarMenuSubButton>
                              </SidebarMenuItem>
                            );
                          })}
                          <SidebarMenuItem>
                            <AddFileDialog
                              projectId={currentProject.id}
                              projectTitle={currentProject.title}
                              onFileAdded={fetchCurrentProjectAndFiles}
                            />
                          </SidebarMenuItem>
                        </>
                      ) : (
                        <div className="p-4 text-center">
                          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                          <p className="mb-3 text-sm text-gray-500">
                            No files yet
                          </p>
                          <AddFileDialog
                            projectId={currentProject.id}
                            projectTitle={currentProject.title}
                            onFileAdded={fetchCurrentProjectAndFiles}
                          />
                        </div>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-100 p-4">
        <UserProfileDropdown userName={userName} />
      </SidebarFooter>
    </Sidebar>
  );
}
