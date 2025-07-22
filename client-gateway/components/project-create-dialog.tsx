import React from 'react';
import { Sheet, SheetContent, SheetHeader } from './ui/sheet';
import { ProjectForm } from './project-form';
import { ProjectFormData } from '@/types/project';

interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onCreate: (form: ProjectFormData) => void;
  onClose: () => void;
}

export function ProjectCreateDialog({ open, onOpenChange, loading, onCreate, onClose }: ProjectCreateDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg w-full">
        <SheetHeader>
          <h2 className="text-xl font-semibold">Create New Project</h2>
        </SheetHeader>
        <ProjectForm
          loading={loading}
          onSubmit={onCreate}
          submitLabel="Create Project"
          allowMultipleFiles={true}
        />
      </SheetContent>
    </Sheet>
  );
} 