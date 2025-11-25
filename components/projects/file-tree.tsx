'use client';

import {
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  Image,
  DonutIcon as DocumentIcon,
  Plus,
  FolderPlus,
} from 'lucide-react';
import { File, Folder, Tree } from '@/components/ui/file-tree';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProjectFile } from '@/hooks/use-file-editor';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: ProjectFile['file'];
}

interface FileTreeProps {
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile['file']) => void;
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string, fileName: string) => void;
  rootFolderName: string;
  projectId: string;
  rootAction?: React.ReactNode;
  onFolderAction?: (folderPath: string) => void;
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'bmp':
    case 'ico':
      return <Image className="h-4 w-4 flex-shrink-0 text-gray-600" />;
    case 'pdf':
      return <DocumentIcon className="h-4 w-4 flex-shrink-0 text-red-500" />;
    case 'doc':
    case 'docx':
      return <DocumentIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />;
    case 'txt':
      return <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />;
    default:
      return <FileText className="h-4 w-4 flex-shrink-0 text-gray-600" />;
  }
};

function buildFileTree(files: ProjectFile[]): FileNode[] {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  files.forEach((projectFile) => {
    const parts = projectFile.file.name.split('/');
    let currentPath = '';
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        if (part !== '.gitkeep') {
          currentLevel.push({
            name: part,
            path: currentPath,
            type: 'file',
            file: projectFile.file,
          });
        }
      } else {
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap.set(currentPath, folder);
          currentLevel.push(folder);
        }
        currentLevel = folder.children!;
      }
    });
  });

  const sortTree = (nodes: FileNode[]): FileNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      })
      .map((node) => {
        if (node.type === 'folder' && node.children) {
          return { ...node, children: sortTree(node.children) };
        }
        return node;
      });
  };

  return sortTree(root);
}

interface FileTreeNodeProps {
  node: FileNode;
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile['file']) => void;
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string, fileName: string) => void;
  onFolderAction?: (folderPath: string) => void;
}

function FileTreeNode({
  node,
  selectedFileId,
  onFileSelect,
  onFileRename,
  onFileDelete,
  onFolderAction,
}: FileTreeNodeProps) {
  if (node.type === 'folder') {
    return (
      <Folder
        element={node.name}
        value={node.path}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`Open options for ${node.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onFolderAction && (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => onFolderAction(node.path)}
                  >
                    <Plus className="size-4" />
                    Add File
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => console.log('Add folder to:', node.path)}
                  >
                    <FolderPlus className="size-4" />
                    Add Folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => console.log('Rename folder:', node.path)}
              >
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                variant="destructive"
                onSelect={() => console.log('Delete folder:', node.path)}
              >
                <Trash2 className="size-4 text-destructive" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
            onFileRename={onFileRename}
            onFileDelete={onFileDelete}
            onFolderAction={onFolderAction}
          />
        ))}
      </Folder>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <File
        value={node.path}
        fileIcon={getFileIcon(node.name)}
        isSelect={selectedFileId === node.file?.id}
        handleSelect={() => node.file && onFileSelect(node.file)}
        className="flex-1"
      >
        <span className="truncate">{node.name}</span>
      </File>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Open options for ${node.name}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() =>
              node.file && onFileRename(node.file.id, node.file.name)
            }
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            variant="destructive"
            onSelect={() =>
              node.file && onFileDelete(node.file.id, node.file.name)
            }
          >
            <Trash2 className="size-4 text-destructive" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function FileTree({
  files,
  selectedFileId,
  onFileSelect,
  onFileRename,
  onFileDelete,
  rootFolderName,
  projectId,
  rootAction,
  onFolderAction,
}: FileTreeProps) {
  const tree = buildFileTree(files);

  return (
    <Tree className="w-full" initialExpandedItems={[projectId]}>
      <Folder element={rootFolderName} value={projectId} action={rootAction}>
        {tree.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
            onFileRename={onFileRename}
            onFileDelete={onFileDelete}
            onFolderAction={onFolderAction}
          />
        ))}
      </Folder>
    </Tree>
  );
}
