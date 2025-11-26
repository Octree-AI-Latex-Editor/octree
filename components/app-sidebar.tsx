'use client';

import { FileText, X } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { useState } from 'react';
import { AddFileDialog } from '@/components/projects/add-file-dialog';
import { AddFolderDialog } from '@/components/projects/add-folder-dialog';
import { RenameFileDialog } from '@/components/projects/rename-file-dialog';
import { RenameFolderDialog } from '@/components/projects/rename-folder-dialog';
import { DeleteFileDialog } from '@/components/projects/delete-file-dialog';
import { FileTree } from '@/components/projects/file-tree';
import { useFileStore, FileActions, useProjectFiles } from '@/stores/file';
import { useProject } from '@/stores/project';

interface AppSidebarProps {
  userName: string | null;
}

interface RenameDialogFile {
  id: string;
  name: string;
}

interface DeleteDialogFile {
  id: string;
  name: string;
}

export function AppSidebar({ userName }: AppSidebarProps) {
  const { toggleSidebar } = useSidebar();
  const { selectedFile } = useFileStore();
  const project = useProject();
  const projectFiles = useProjectFiles();
  const [renameDialogFile, setRenameDialogFile] =
    useState<RenameDialogFile | null>(null);
  const [deleteDialogFile, setDeleteDialogFile] =
    useState<DeleteDialogFile | null>(null);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);
  const [addFolderDialogOpen, setAddFolderDialogOpen] = useState(false);
  const [renameFolderPath, setRenameFolderPath] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<string | null>(null);

  if (!project) return null;

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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {!projectFiles ? (
              <div className="p-6 text-center">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                  <div className="h-3 w-1/2 rounded bg-gray-200"></div>
                  <div className="h-3 w-2/3 rounded bg-gray-200"></div>
                </div>
              </div>
            ) : projectFiles.length > 0 ? (
              <>
                <FileTree
                  files={projectFiles}
                  selectedFileId={selectedFile?.id || null}
                  onFileSelect={(file) => FileActions.setSelectedFile(file)}
                  onFileRename={(fileId, fileName) =>
                    setRenameDialogFile({ id: fileId, name: fileName })
                  }
                  onFileDelete={(fileId, fileName) =>
                    setDeleteDialogFile({ id: fileId, name: fileName })
                  }
                  rootFolderName={project.title}
                  projectId={project.id}
                  onAddFile={(folderPath) => {
                    setTargetFolder(folderPath || null);
                    setAddFileDialogOpen(true);
                  }}
                  onAddFolder={(folderPath) => {
                    setTargetFolder(folderPath || null);
                    setAddFolderDialogOpen(true);
                  }}
                  onFolderRename={(folderPath) => {
                    setRenameFolderPath(folderPath);
                  }}
                />
                <AddFileDialog
                  projectId={project.id}
                  projectTitle={project.title}
                  open={addFileDialogOpen}
                  onOpenChange={setAddFileDialogOpen}
                  targetFolder={targetFolder}
                />
                <AddFolderDialog
                  projectId={project.id}
                  projectTitle={project.title}
                  open={addFolderDialogOpen}
                  onOpenChange={setAddFolderDialogOpen}
                  targetFolder={targetFolder}
                />
                {renameFolderPath && (
                  <RenameFolderDialog
                    projectId={project.id}
                    currentPath={renameFolderPath}
                    open={true}
                    onOpenChange={(open) => !open && setRenameFolderPath(null)}
                  />
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="mb-3 text-sm text-gray-500">No files yet</p>
                <AddFileDialog
                  projectId={project.id}
                  projectTitle={project.title}
                />
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-100 p-4">
        <UserProfileDropdown userName={userName} />
      </SidebarFooter>

      {renameDialogFile && (
        <RenameFileDialog
          projectId={project.id}
          fileId={renameDialogFile.id}
          currentName={renameDialogFile.name}
          open={true}
          onOpenChange={(open) => !open && setRenameDialogFile(null)}
        />
      )}
      {deleteDialogFile && (
        <DeleteFileDialog
          projectId={project.id}
          fileId={deleteDialogFile.id}
          fileName={deleteDialogFile.name}
          open={true}
          onOpenChange={(open) => !open && setDeleteDialogFile(null)}
        />
      )}
    </Sidebar>
  );
}
