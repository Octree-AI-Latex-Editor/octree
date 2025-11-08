'use client';

import { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database } from '@/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

export const columns = ({
  onDelete,
  onRename,
}: {
  onDelete: (projectId: string, projectTitle: string) => void;
  onRename: (projectId: string, projectTitle: string) => void;
}): ColumnDef<Project>[] => [
  {
    accessorKey: 'title',
    header: 'Title',
    size: 1000,
    cell: ({ row }) => {
      const title = row.getValue('title') as string;
      return (
        <div className="max-w-[1000px] truncate" title={title}>
          {title}
        </div>
      );
    },
  },
  {
    accessorKey: 'updated_at',
    header: 'Last Updated',
    size: 200,
    cell: ({ row }) => {
      return dayjs(row.getValue('updated_at')).format('MMM D, YYYY h:mm A');
    },
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => {
      const project = row.original;

      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <DropdownMenuLabel>Actions</DropdownMenuLabel>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  onRename(project.id, project.title);
                }}
              >
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                variant="destructive"
                onClick={() => {
                  onDelete(project.id, project.title);
                }}
              >
                <Trash2 className="size-4 text-destructive" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
