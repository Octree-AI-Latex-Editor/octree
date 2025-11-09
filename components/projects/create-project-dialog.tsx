'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateProjectTabs } from '@/components/projects/create-project-tabs';

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = (projectId: string) => {
    setOpen(false);
    router.push(`/projects/${projectId}`);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-gradient-to-b from-primary-light to-primary hover:bg-gradient-to-b hover:from-primary-light/90 hover:to-primary/90"
        >
          <PlusIcon />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new project or import from a ZIP file.
          </DialogDescription>
        </DialogHeader>

        <CreateProjectTabs onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
