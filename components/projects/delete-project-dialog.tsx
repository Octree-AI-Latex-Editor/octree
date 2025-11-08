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
import { useTranslations } from 'next-intl';

export function DeleteProjectDialog({
  row,
}: {
  row: { id: string; title: string };
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { deleteProjectWithRefresh } = useDeleteProject();
  const t = useTranslations('deleteProjectDialog');
  const tCommon = useTranslations('common');

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const result = await deleteProjectWithRefresh(row.id);

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.message || t('errorDeleteFailed'));
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
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { title: row.title })}
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
            {tCommon('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? t('deleting') : t('deleteProject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
