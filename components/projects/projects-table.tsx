'use client';

import { useEffect, useState } from 'react';
import { columns } from './columns';
import { DataTable } from './data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { Project, SelectedProject } from '@/types/project';
import { useProjectRefresh } from '@/app/context/project';
import { useDeleteProject } from '@/hooks/delete-project-client';
import { useRenameProject } from '@/hooks/rename-project-client';
import { Input } from '@/components/ui/input';

export function ProjectsTable({ data }: { data: Project[] }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Project[]>(data);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRows, setFilteredRows] = useState<Project[]>(data);
  const { refreshProjects } = useProjectRefresh();
  const { deleteProjectWithRefresh } = useDeleteProject();
  const { renameProjectWithRefresh } = useRenameProject();

  // Keep local rows in sync if server-provided data changes
  useEffect(() => {
    setRows(data);
    setFilteredRows(data);
  }, [data]);

  // Filter rows based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRows(rows);
    } else {
      const filtered = rows.filter((project) =>
        project.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRows(filtered);
    }
  }, [searchQuery, rows]);

  const handleDeleteClick = (projectId: string, projectTitle: string) => {
    setSelectedProject({
      id: projectId,
      title: projectTitle,
    });
    setIsDeleteDialogOpen(true);
  };

  const handleRenameClick = (projectId: string, projectTitle: string) => {
    setSelectedProject({ id: projectId, title: projectTitle });
    setRenameValue(projectTitle);
    setIsRenameDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;

    setIsLoading(true);
    setError(null);

    const result = await deleteProjectWithRefresh(selectedProject.id);

    if (result.success) {
      // Optimistically remove the deleted row to avoid full reload and flicker
      setRows((prev) => prev.filter((p) => p.id !== selectedProject.id));
      setFilteredRows((prev) =>
        prev.filter((p) => p.id !== selectedProject.id)
      );
      // Notify other UI (e.g., sidebar) to refresh
      refreshProjects();
      closeDialog();
    } else {
      setError(result.message || 'Failed to delete project');
    }

    setIsLoading(false);
  };

  const closeDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedProject(null);
    setError(null);
  };

  return (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-neutral-500">
            {filteredRows.length} project{filteredRows.length !== 1 ? 's' : ''}{' '}
            found
          </p>
        )}
      </div>

      <DataTable
        columns={columns({
          onDelete: handleDeleteClick,
          onRename: handleRenameClick,
        })}
        data={filteredRows}
      />

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(isOpen) => setIsDeleteDialogOpen(isOpen)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedProject?.title}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(isOpen) => {
          setIsRenameDialogOpen(isOpen);
          if (!isOpen) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Update the title for &quot;{selectedProject?.title}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Project title"
            />
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRenameDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedProject) return;
                const id = selectedProject.id;
                const nextTitle = renameValue.trim();
                if (!nextTitle) {
                  setError('Title is required');
                  return;
                }
                setIsLoading(true);
                setError(null);
                // Optimistic update
                setRows((prev) =>
                  prev.map((p) =>
                    p.id === id ? { ...p, title: nextTitle } : p
                  )
                );
                setFilteredRows((prev) =>
                  prev.map((p) =>
                    p.id === id ? { ...p, title: nextTitle } : p
                  )
                );
                const res = await renameProjectWithRefresh(id, nextTitle);
                if (!res.success) {
                  // Rollback title if failed
                  setRows((prev) =>
                    prev.map((p) =>
                      p.id === id ? { ...p, title: selectedProject.title } : p
                    )
                  );
                  setFilteredRows((prev) =>
                    prev.map((p) =>
                      p.id === id ? { ...p, title: selectedProject.title } : p
                    )
                  );
                  setError(res.message || 'Failed to rename project');
                } else {
                  setIsRenameDialogOpen(false);
                }
                setIsLoading(false);
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
