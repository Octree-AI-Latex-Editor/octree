'use client';

import { useState, useRef } from 'react';
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
import { Plus, Upload, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TablesInsert } from '@/database.types';
import { useProjectFilesRevalidation } from '@/hooks/use-file-editor';
import { FileActions } from '@/stores/file';
import { createDocumentForFile } from '@/lib/requests/project';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { revalidate } = useProjectFilesRevalidation(projectId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setUploadMode('upload');
    }
  };

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
      const { data: fileData, error: fileError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('files') as any).insert(fileInsert).select().single();

      if (fileError) {
        throw new Error('Failed to create file record');
      }

      try {
        await createDocumentForFile(projectId, fileName, content);
      } catch (documentError) {
        console.warn('Failed to create document record:', documentError);
      }

      // Select the newly created file
      FileActions.setSelectedFileId(fileData.id);

      setOpen(false);
      setFileName('');
      setSelectedFile(null);
      setUploadMode('create');
      onFileAdded?.();
      revalidate();
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
      const { data: fileData, error: fileError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('files') as any).insert(fileInsert2).select().single();

      if (fileError) {
        throw new Error('Failed to create file record');
      }

      // Always create a document for the file
      try {
        await createDocumentForFile(
          projectId,
          fileName,
          fileContent || undefined
        );
      } catch (documentError) {
        console.warn('Failed to create document record:', documentError);
      }

      // Select the newly created file
      FileActions.setSelectedFileId(fileData.id);

      setOpen(false);
      setFileName('');
      setFileContent('');
      onFileAdded?.();
      revalidate();
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

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={uploadMode === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMode('create')}
            disabled={isLoading}
          >
            <FileText className="mr-2 h-4 w-4" />
            Create New
          </Button>
          <Button
            type="button"
            variant={uploadMode === 'upload' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMode('upload')}
            disabled={isLoading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>

        {uploadMode === 'create' ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="fileName">File Name</Label>
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
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="fileUpload">Select File</Label>
              <input
                ref={fileInputRef}
                type="file"
                id="fileUpload"
                onChange={handleFileSelect}
                className="hidden"
                accept=".tex,.txt,.md,.json,.js,.ts,.py,.java,.cpp,.c,.html,.css,.xml,.yaml,.yml"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
              {selectedFile && (
                <div className="text-sm text-green-600">
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <Label htmlFor="uploadFileName">File Name (Optional)</Label>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
