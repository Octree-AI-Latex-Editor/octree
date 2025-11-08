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
import { useTranslations } from 'next-intl';

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('create');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createProjectWithRefresh } = useCreateProject();
  const router = useRouter();
  const t = useTranslations('createProjectDialog');
  const tCommon = useTranslations('common');

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('create');
  const [isDragging, setIsDragging] = useState(false);
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

  const validateAndSetFile = (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError(t('errorSelectZip'));
      setSelectedFile(null);
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError(t('errorFileSizeLimit'));
      setSelectedFile(null);
      return false;
    }
    setSelectedFile(file);
    setError(null);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(t('errorSelectFile'));
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
        throw new Error(data.error || t('errorImportFailed'));
      }

      if (data.success && data.projectId) {
        const message = data.otherFiles > 0 
          ? t('projectImportSuccessWithFiles', { texFiles: data.texFiles, otherFiles: data.otherFiles })
          : t('projectImportSuccessTexOnly', { texFiles: data.texFiles });
        toast.success(message);
        setOpen(false);
        setSelectedFile(null);
        router.push(`/projects/${data.projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorImportFailed'));
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
      setIsDragging(false);
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
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">{t('createNew')}</TabsTrigger>
            <TabsTrigger value="import">{t('importZip')}</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="title">{t('projectTitle')}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('projectTitlePlaceholder')}
                  disabled={isLoading}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>
                    {tCommon('cancel')}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading || !title.trim()}>
                  {isLoading ? t('creating') : tCommon('create')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <form onSubmit={handleImportSubmit} className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="zipFile">{t('zipFile')}</Label>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative rounded-lg border-2 border-dashed p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Input
                    id="zipFile"
                    type="file"
                    accept=".zip"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center gap-2">
                    <Upload className={`h-10 w-10 ${isDragging ? 'text-primary' : 'text-neutral-400'}`} />
                    <div className="text-sm">
                      <span className="font-medium text-primary">{t('clickToUpload')}</span>
                      <span className="text-neutral-600"> {t('dragAndDrop')}</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {t('zipFilesUpTo')}
                    </p>
                  </div>
                </div>

                {selectedFile && (
                  <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2 text-sm min-w-0 overflow-hidden">
                      <div className="rounded bg-primary/10 p-1">
                        <Upload className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 max-w-full">
                        <p
                          className="block max-w-[220px] truncate font-medium text-neutral-900 sm:max-w-[320px]"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-end sm:self-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      disabled={isLoading}
                    >
                      {tCommon('remove')}
                    </Button>
                  </div>
                )}
                
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>
                    {tCommon('cancel')}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={isLoading || !selectedFile}
                  className="gap-2"
                >
                  {isLoading ? (
                    t('importing')
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {t('import')}
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
