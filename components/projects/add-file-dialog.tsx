'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { TablesInsert } from '@/database.types';
import { useProjectFilesRevalidation } from '@/hooks/use-file-editor';
import { FileActions } from '@/stores/file';
import { createDocumentForFile } from '@/lib/requests/project';
import {
  SUPPORTED_TEXT_FILE_TYPES,
  SUPPORTED_TEXT_FILE_EXTENSIONS,
  MAX_TEXT_FILE_SIZE,
} from '@/lib/constants/file-types';

interface AddFileDialogProps {
  projectId: string;
  projectTitle: string;
  onFileAdded?: () => void;
}

export function AddFileDialog({
  projectId,
  projectTitle,
  onFileAdded,
}: AddFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'create' | 'upload'>('create');
  const { revalidate } = useProjectFilesRevalidation(projectId);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      setFileName(file.name);
      setUploadMode('upload');
      setError(null);
    }
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFileDialog,
  } = useDropzone({
    onDrop,
    accept: SUPPORTED_TEXT_FILE_TYPES,
    maxSize: MAX_TEXT_FILE_SIZE,
    multiple: false,
    disabled: isLoading,
    noClick: true,
    noKeyboard: true,
  });

  const handleFileUpload = async () => {
    if (!selectedFile || !fileName.trim()) return;

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

      const content = await selectedFile.text();

      const fileInsert: TablesInsert<'files'> = {
        project_id: projectId,
        name: fileName,
        type: selectedFile.type || 'text/plain',
        size: selectedFile.size,
      };
      const { data: fileData, error: fileError } = await (
        supabase.from('files') as any
      )
        .insert(fileInsert)
        .select()
        .single();

      if (fileError) {
        throw new Error('Failed to create file record');
      }

      try {
        await createDocumentForFile(projectId, fileName, content);
      } catch (documentError) {
        console.warn('Failed to create document record:', documentError);
      }

      setOpen(false);
      setFileName('');
      setSelectedFile(null);
      setUploadMode('create');
      onFileAdded?.();
      revalidate();
      FileActions.setSelectedFile(fileData);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to upload file'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

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

      const fileInsert2: TablesInsert<'files'> = {
        project_id: projectId,
        name: fileName,
        type: 'text/plain',
        size: fileContent.length,
      };
      const { data: fileData, error: fileError } = await (
        supabase.from('files') as any
      )
        .insert(fileInsert2)
        .select()
        .single();

      if (fileError) {
        throw new Error('Failed to create file record');
      }

      // Always create a document for the file
      try {
        await createDocumentForFile(
          projectId,
          fileName,
          fileContent || undefined,
          { useDefaultContent: false }
        );
      } catch (documentError) {
        console.warn('Failed to create document record:', documentError);
      }

      setOpen(false);
      setFileName('');
      setFileContent('');
      onFileAdded?.();
      revalidate();
      FileActions.setSelectedFile(fileData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit =
    uploadMode === 'upload' ? handleFileUpload : handleCreateFile;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-gray-200 px-2 py-1 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900">
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Add File</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add File to {projectTitle}</DialogTitle>
          <DialogDescription>
            Create a new file or upload an existing file to this project.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={uploadMode}
          onValueChange={(value) => setUploadMode(value as 'create' | 'upload')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" disabled={isLoading}>
              <FileText className="h-4 w-4" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="upload" disabled={isLoading}>
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="fileName">Name</Label>
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter file name (e.g., document.tex)"
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
                  {isLoading ? 'Creating...' : 'Create File'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="fileUpload">Select File</Label>
                <div
                  {...getRootProps()}
                  className={cn(
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200',
                    isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50',
                    isLoading && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input {...getInputProps()} />

                  <div className="flex flex-col items-center gap-2">
                    <Upload
                      className={cn(
                        'h-8 w-8',
                        isDragActive ? 'text-primary' : 'text-neutral-400'
                      )}
                    />
                    <div className="text-sm">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFileDialog();
                        }}
                        className="font-medium text-primary hover:underline"
                        disabled={isLoading}
                      >
                        Click to upload
                      </button>
                      <span className="text-neutral-600">
                        {' '}
                        or drag and drop
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {SUPPORTED_TEXT_FILE_EXTENSIONS.join(', ')} (max{' '}
                      {MAX_TEXT_FILE_SIZE / 1024 / 1024}MB)
                    </p>
                  </div>
                </div>

                {selectedFile && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <p className="font-medium">Selected: {selectedFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <Label htmlFor="uploadFileName">Name (Optional)</Label>
                <Input
                  id="uploadFileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter custom name or keep original"
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
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !selectedFile}
                >
                  {isLoading ? 'Uploading...' : 'Upload File'}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
