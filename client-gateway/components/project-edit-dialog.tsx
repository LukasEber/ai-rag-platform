import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetFooter } from './ui/sheet';
import { Button } from './ui/button';
import { ProjectForm } from './project-form';
import { ProjectWithFiles, ProjectFormData } from '@/types/project';

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithFiles | null;
  onSave: (form: ProjectFormData) => void;
  onRemoveFile: (fileId: string) => void;
  loading: boolean;
  onClose: () => void;
}

export function ProjectEditDialog({ open, onOpenChange, project, onSave, onRemoveFile, loading, onClose }: ProjectEditDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg w-full">
        <SheetHeader>
          <h2 className="text-xl font-semibold">Edit Project</h2>
        </SheetHeader>
        {project && (
          <>
            <ProjectForm
              initial={{ name: project.name, visibility: project.visibility }}
              loading={loading}
              onSubmit={onSave}
              submitLabel="Save Changes"
              allowMultipleFiles={true}
            />
            <div className="mt-4">
              <div className="font-semibold mb-2">Files:</div>
              {project.files && project.files.length > 0 ? (
                <ul className="list-disc pl-4">
                  {project.files.map((file) => (
                    <li key={file.id} className="mb-1 flex items-center justify-between">
                      <span>
                        <span className="font-medium">{file.fileName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(1)} KB</span>
                        <span className="ml-2 text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleString()}</span>
                      </span>
                      <Button variant="destructive" size="sm" onClick={() => onRemoveFile(file.id)} disabled={loading}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground">No files uploaded.</div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
} 