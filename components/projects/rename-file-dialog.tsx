'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

interface RenameFileDialogProps {
  projectId: string;
  fileId: string;
  currentName: string;
  onRenamed?: (newName: string) => void;
}

export function RenameFileDialog({
  projectId,
  fileId,
  currentName,
  onRenamed,
}: RenameFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const handleRename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = fileName.trim();

    if (!trimmedName) {
      setError('File name is required');
      return;
    }

    if (trimmedName === currentName) {
      setOpen(false);
      return;
    }

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

      const { error: updateFileError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('files') as any)
          .update({ name: trimmedName })
          .eq('id', fileId)
          .eq('project_id', projectId);

      if (updateFileError) {
        throw new Error('Failed to rename file');
      }

      const { error: updateDocumentError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('documents') as any)
          .update({
            title: trimmedName,
            filename: trimmedName,
            updated_at: new Date().toISOString(),
          })
          .eq('project_id', projectId)
          .eq('filename', currentName)
          .eq('owner_id', session.user.id);

      if (updateDocumentError) {
        console.warn(
          'Failed to update associated document name:',
          updateDocumentError
        );
      }

      toast.success('File renamed successfully');
      onRenamed?.(trimmedName);
      setOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to rename file';
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
        >
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>
            Update the file name. This will also update the associated document
            name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRename} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="file-name">File name</Label>
            <Input
              id="file-name"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="Enter a new file name"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
