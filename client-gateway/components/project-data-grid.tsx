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
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

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
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    project: Project | null;
  }>({
    isOpen: false,
    project: null,
  });

  const handleDeleteClick = (project: Project) => {
    setDeleteDialog({ isOpen: true, project });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.project) {
      await onDelete(deleteDialog.project);
    }
    setDeleteDialog({ isOpen: false, project: null });
  };

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
              <span>Ready</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Indexing...</span>
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
      cell: ({ row }) => {
        const project = row.original;
        const isIndexing = !project.isIndexed;
        
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onView(project)}>View</Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isIndexing}
              onClick={() => onEdit(project)}
              title={isIndexing ? 'Not available during indexing' : undefined}
            >
              Edit
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              disabled={isIndexing}
              onClick={() => handleDeleteClick(project)}
              title={isIndexing ? 'Not available during indexing' : undefined}
            >
              Delete
            </Button>
          </div>
        );
      },
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
    <>
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

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, project: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        itemName={deleteDialog.project?.name}
        type="project"
      />
    </>
  );
} 