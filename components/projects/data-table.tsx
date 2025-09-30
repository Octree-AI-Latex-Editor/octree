'use client';

import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

interface DataTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData extends { id: string }, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleProjectClick = async (projectId: string) => {
    if (loadingProjectId) return; // Prevent multiple clicks
    
    setLoadingProjectId(projectId);
    
    try {
      const supabase = createClient();
      
      // Get the latest file for this project
      const { data: files, error } = await supabase
        .from('files')
        .select('id, name')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      if (error || !files || files.length === 0) {
        // If no files found, redirect to the project files page
        router.push(`/projects/${projectId}/files`);
        return;
      }

      const latestFile = files[0];
      router.push(`/projects/${projectId}/files/${latestFile.id}/editor`);
    } catch (error) {
      console.error('Error getting latest file:', error);
      setLoadingProjectId(null); // Reset on error
      // Fallback to project files page
      router.push(`/projects/${projectId}/files`);
    }
  };

  return (
    <div className="relative rounded-md border">
      {/* Loading overlay */}
      {loadingProjectId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-700">Opening project...</p>
          </div>
        </div>
      )}
      
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={`cursor-pointer transition-opacity ${loadingProjectId && loadingProjectId !== row.original.id ? 'opacity-50' : ''}`}
                onClick={() => handleProjectClick(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-12 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
