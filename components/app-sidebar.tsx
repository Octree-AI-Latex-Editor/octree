'use client';

import { Trash2, Folder, FileText, ChevronDown, File as DocumentIcon, FolderOpen } from 'lucide-react';
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
import type { MouseEvent } from 'react';
import { DeleteFileDialog } from '@/components/files/delete-file-dialog';

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

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; fileId: string; fileName: string }>({
    open: false,
    fileId: '',
    fileName: '',
  })

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

  const handleDeleteClick = (e: MouseEvent, fileId: string, fileName: string) => {
    e.preventDefault() // Prevent navigation
    e.stopPropagation() // Prevent event bubbling
    setDeleteDialog({
      open: true,
      fileId,
      fileName,
    })
  }

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
                                  className={`group rounded-md transition-all duration-200 ${
                                    isActive
                                      ? 'border border-blue-500 bg-blue-50 text-blue-700'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <Link
                                    href={`/projects/${currentProject.id}/files/${file.id}/editor`}
                                    className="flex items-center gap-3"
                                  >
                                    {getFileIcon(file.name)}
                                    <div className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {file.name}
                                      </span>
                                    </div>
                                    <Trash2 
                                      className="h-4 w-4 text-red-500 hover:text-red-700 cursor-pointer" 
                                      onClick={(e) => handleDeleteClick(e, file.id, file.name)}
                                    />
                                  </Link>
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

      {currentProject && deleteDialog.open && (
        <DeleteFileDialog
          fileId={deleteDialog.fileId}
          fileName={deleteDialog.fileName}
          projectId={currentProject.id}
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
          onFileDeleted={fetchCurrentProjectAndFiles}
          availableFiles={currentProject.files}
        />
      )}
    </Sidebar>
  );
}
