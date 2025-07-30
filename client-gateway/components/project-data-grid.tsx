import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { Button } from './ui/button';
import { GlobeIcon, LockIcon } from './icons';
import { Project } from '@/types/project';

const VISIBILITY_OPTIONS = [
  {
    id: 'private',
    label: 'Private',
    icon: <LockIcon size={16} />,
  },
  {
    id: 'public',
    label: 'Public',
    icon: <GlobeIcon size={16} />,
  },
] as const;

interface ProjectDataGridProps {
  projects: Project[];
  loading: boolean;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export function ProjectDataGrid({ projects, loading, onView, onEdit, onDelete }: ProjectDataGridProps) {
  const columnHelper = createColumnHelper<Project>();
  const columns: ColumnDef<Project, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('visibility', {
      header: 'Visibility',
      cell: info => (
        <span className="capitalize flex items-center gap-2">
          {VISIBILITY_OPTIONS.find(v => v.id === info.getValue())?.icon}
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('isIndexed', {
      header: 'Status',
      cell: info => (
        <span className={`flex items-center gap-2 ${info.getValue() ? 'text-green-600' : 'text-orange-600'}`}>
          {info.getValue() ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Einsatzbereit</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Indexierung läuft...</span>
            </>
          )}
        </span>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: info => new Date(info.getValue()).toLocaleString(),
    }),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onView(row.original)}>View</Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(row.original)}>Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(row.original)}>Delete</Button>
        </div>
      ),
    },
  ];

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: projects,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="overflow-x-auto w-full max-w-6xl mx-auto">
      <table className="min-w-[700px] divide-y divide-border bg-card rounded-lg">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="bg-card transition-colors hover:bg-muted">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-4 py-2 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 