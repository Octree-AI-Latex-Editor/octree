'use client';

import {
  Folder,
  FileText,
  ChevronDown,
  DonutIcon as DocumentIcon,
  FolderOpen,
  MoreHorizontal,
  X,
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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectRefresh } from '@/app/context/project';
import { AddFileDialog } from '@/components/projects/add-file-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameFileDialog } from '@/components/projects/rename-file-dialog';
import { DeleteFileDialog } from '@/components/projects/delete-file-dialog';
import useSWR, { useSWRConfig } from 'swr';
import { getProject } from '@/lib/requests/project';
import type { Project } from '@/types/project';
import type { Tables } from '@/database.types';
import { useFileStore } from '@/stores/file';

type File = Tables<'files'>;

interface AppSidebarProps {
  userName: string | null;
  projectId?: string;
}

const fetchFiles = async (projectId: string): Promise<File[]> => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

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

export function AppSidebar({ userName, projectId }: AppSidebarProps) {
  const [isProjectOpen, setIsProjectOpen] = useState(true);
  const { refreshTrigger } = useProjectRefresh();
  const { toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const { selectedFileId, setSelectedFileId } = useFileStore();

  const { data: projectData, isLoading: isProjectLoading } = useSWR<Project>(
    projectId ? ['project', projectId] : null,
    () => getProject(projectId!)
  );

  const { data: filesData, isLoading: isFilesLoading } = useSWR<File[]>(
    projectId ? ['files', projectId] : null,
    () => fetchFiles(projectId!)
  );

  const isLoading = isProjectLoading || isFilesLoading;

  useEffect(() => {
    if (filesData && filesData.length > 0 && !selectedFileId) {
      const mainTexFile = filesData.find((file) => file.name === 'main.tex');
      if (mainTexFile) {
        setSelectedFileId(mainTexFile.id);
      } else {
        setSelectedFileId(filesData[0].id);
      }
    }
  }, [filesData]);

  const refreshData = () => {
    if (projectId) {
      mutate(['project', projectId]);
      mutate(['files', projectId]);
    }
  };

  useEffect(() => {
    refreshData();
  }, [refreshTrigger, projectId]);

  return (
    <Sidebar collapsible="offcanvas" className="w-64">
      <SidebarHeader className="flex-row items-center justify-between border-b border-gray-200">
        <p className="px-3 text-sm font-medium">Files</p>
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 transition-colors hover:bg-gray-100"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarGroup>
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
              ) : !projectData ? (
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
                        <div className="flex items-center gap-1.5">
                          {isProjectOpen ? (
                            <FolderOpen className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Folder className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="truncate font-medium text-gray-900">
                            {projectData.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-400 transition-transform ${isProjectOpen ? 'rotate-180' : ''}`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>

                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-1 space-y-1">
                      {filesData && filesData.length > 0 ? (
                        <>
                          {filesData.map((file) => {
                            const isActive = selectedFileId === file.id;
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
                                  <div className="flex w-full items-center gap-2 hover:bg-gray-100 hover:ring-1 hover:ring-gray-200">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedFileId(file.id)}
                                      className="flex flex-1 items-center gap-1.5 overflow-hidden px-1 py-1 text-left"
                                    >
                                      {getFileIcon(file.name)}
                                      <div className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                          {file.name}
                                        </span>
                                      </div>
                                    </button>
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
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        <RenameFileDialog
                                          projectId={projectData.id}
                                          fileId={file.id}
                                          currentName={file.name}
                                          onRenamed={refreshData}
                                        />
                                        <DeleteFileDialog
                                          projectId={projectData.id}
                                          fileId={file.id}
                                          fileName={file.name}
                                          onDeleted={refreshData}
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
                              projectId={projectData.id}
                              projectTitle={projectData.title}
                              onFileAdded={refreshData}
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
                            projectId={projectData.id}
                            projectTitle={projectData.title}
                            onFileAdded={refreshData}
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
