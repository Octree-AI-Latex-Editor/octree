'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { deleteFile } from '@/actions/delete-file';
import { useRouter } from 'next/navigation';

interface DeleteFileDialogProps {
  fileId: string;
  fileName: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileDeleted?: () => void;
  availableFiles?: Array<{ id: string; name: string }>;
}

export function DeleteFileDialog({
  fileId,
  fileName,
  projectId,
  open,
  onOpenChange,
  onFileDeleted,
  availableFiles = [],
}: DeleteFileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('fileId', fileId);
    formData.append('projectId', projectId);

    const result = await deleteFile(
      { fileId: null, projectId: null },
      formData
    );

    if (result.success) {
      onOpenChange(false);
      // Call the callback to refresh the sidebar
      if (onFileDeleted) {
        onFileDeleted();
      }
      // Navigate to another file if we're currently viewing the deleted file
      const currentPath = window.location.pathname;
      if (currentPath.includes(`/files/${fileId}/editor`)) {
        // Find the latest edited file (excluding the one being deleted)
        const otherFiles = availableFiles.filter(file => file.id !== fileId);
        if (otherFiles.length > 0) {
          // Navigate to the first available file (most recent)
          router.push(`/projects/${projectId}/files/${otherFiles[0].id}/editor`);
        } else {
          // No other files, go to project page
          router.push(`/projects/${projectId}`);
        }
      }
    } else {
      setError(result.message || 'Failed to delete file');
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{fileName}"? This action cannot be
            undone and will permanently remove the file.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
