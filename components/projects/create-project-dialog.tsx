'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusIcon, Upload } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateProject } from '@/hooks/create-project-client';
import { toast } from 'sonner';

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('create');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createProjectWithRefresh } = useCreateProject();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('title', title);

    const result = await createProjectWithRefresh(formData);

    if (result.success && result.projectId) {
      setOpen(false);
      setTitle('');
      router.push(`/projects/${result.projectId}`);
    } else {
      setError(result.message || 'Failed to create project');
    }

    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setError('Please select a ZIP file');
        setSelectedFile(null);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import-project', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import project');
      }

      if (data.success && data.projectId) {
        toast.success(
          `Project imported successfully! ${data.texFilesImported} LaTeX file(s) and ${data.filesImported} total file(s).`
        );
        setOpen(false);
        setSelectedFile(null);
        router.push(`/projects/${data.projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when dialog closes
      setTitle('');
      setSelectedFile(null);
      setError(null);
      setActiveTab('create');
    }
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="import">Import ZIP</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter project title"
                  disabled={isLoading}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading || !title.trim()}>
                  {isLoading ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <form onSubmit={handleImportSubmit} className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="zipFile">ZIP File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="zipFile"
                    type="file"
                    accept=".zip"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      disabled={isLoading}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-sm text-neutral-600">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <p className="text-xs text-neutral-500">
                  Upload a ZIP file containing your LaTeX project. Maximum size: 50MB
                </p>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={isLoading || !selectedFile}
                  className="gap-2"
                >
                  {isLoading ? (
                    'Importing...'
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
