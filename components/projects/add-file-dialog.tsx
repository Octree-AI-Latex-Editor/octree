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
import { useProjectFilesRevalidation } from '@/hooks/use-file-editor';
import { FileActions } from '@/stores/file';

interface AddFileDialogProps {
  projectId: string;
  projectTitle: string;
  onFileAdded?: () => void;
}

const getMimeTypeFromFileName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    tex: 'application/x-latex',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    js: 'application/javascript',
    ts: 'application/typescript',
    py: 'text/x-python',
    java: 'text/x-java',
    cpp: 'text/x-c++src',
    c: 'text/x-csrc',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',
    yaml: 'application/x-yaml',
    yml: 'application/x-yaml',
    bib: 'application/x-bibtex',
  };
  return mimeTypes[extension || ''] || 'text/plain';
};

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

      const mimeType = getMimeTypeFromFileName(fileName);
      const { error: uploadError } = await supabase.storage
        .from('octree')
        .upload(`projects/${projectId}/${fileName}`, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType,
        });

      if (uploadError) {
        throw new Error('Failed to upload file');
      }

      const { data: storageFiles } = await supabase.storage
        .from('octree')
        .list(`projects/${projectId}`);

      const uploadedFile = storageFiles?.find((f) => f.name === fileName);

      setOpen(false);
      setFileName('');
      setSelectedFile(null);
      setUploadMode('create');
      onFileAdded?.();
      revalidate();

      if (uploadedFile) {
        FileActions.setSelectedFile({
          id: uploadedFile.id,
          name: uploadedFile.name,
          project_id: projectId,
          size: uploadedFile.metadata?.size || null,
          type: uploadedFile.metadata?.mimetype || null,
          uploaded_at: uploadedFile.created_at,
        });
      }
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

      const content = fileContent || '';
      const mimeType = getMimeTypeFromFileName(fileName);
      const blob = new Blob([content], { type: mimeType });

      const { error: uploadError } = await supabase.storage
        .from('octree')
        .upload(`projects/${projectId}/${fileName}`, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType,
        });

      if (uploadError) {
        throw new Error('Failed to create file');
      }

      const { data: storageFiles } = await supabase.storage
        .from('octree')
        .list(`projects/${projectId}`);

      const createdFile = storageFiles?.find((f) => f.name === fileName);

      setOpen(false);
      setFileName('');
      setFileContent('');
      onFileAdded?.();
      revalidate();

      if (createdFile) {
        FileActions.setSelectedFile({
          id: createdFile.id,
          name: createdFile.name,
          project_id: projectId,
          size: createdFile.metadata?.size || null,
          type: createdFile.metadata?.mimetype || null,
          uploaded_at: createdFile.created_at,
        });
      }
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
        <div className="flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-dashed border-gray-200 px-1 py-0.5 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900">
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
