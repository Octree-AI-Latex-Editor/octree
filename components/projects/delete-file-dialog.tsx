'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { useProjectFilesRevalidation } from '@/hooks/use-file-editor';

interface DeleteFileDialogProps {
  projectId: string;
  fileId: string;
  fileName: string;
  onDeleted?: () => void;
}

export function DeleteFileDialog({
  projectId,
  fileId,
  fileName,
  onDeleted,
}: DeleteFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { revalidate } = useProjectFilesRevalidation(projectId);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Delete associated document first
      const { error: deleteDocumentError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('documents') as any)
          .delete()
          .eq('project_id', projectId)
          .eq('filename', fileName)
          .eq('owner_id', session.user.id);

      if (deleteDocumentError) {
        console.warn(
          'Failed to delete associated document:',
          deleteDocumentError
        );
      }

      // Delete the file from the files table
      const { error: deleteFileError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('files') as any)
          .delete()
          .eq('id', fileId)
          .eq('project_id', projectId);

      if (deleteFileError) {
        throw new Error('Failed to delete file');
      }

      toast.success('File deleted successfully');
      revalidate();

      onDeleted?.();
      setOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete file';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(event) => event.preventDefault()}
          className="cursor-pointer gap-2"
          variant="destructive"
        >
          <Trash2 className="size-4 text-destructive" />
          Delete
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{fileName}&quot;? This will
            also delete the associated document. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
