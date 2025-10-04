'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useDeleteProject } from '@/hooks/delete-project-client';

export function DeleteProjectDialog({
  row,
}: {
  row: { id: string; title: string };
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { deleteProjectWithRefresh } = useDeleteProject();

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const result = await deleteProjectWithRefresh(row.id);

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.message || 'Failed to delete project');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{row.title}"? This action cannot be
            undone and will permanently remove the project and all its files.
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
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
