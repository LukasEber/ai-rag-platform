import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetFooter } from './ui/sheet';
import { Button } from './ui/button';
import { ProjectWithFiles } from '@/types/project';

interface ProjectViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithFiles | null;
  onClose: () => void;
}

export function ProjectViewDialog({ open, onOpenChange, project, onClose }: ProjectViewDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-md w-full">
        <SheetHeader>
          <h2 className="text-xl font-semibold">Project Details</h2>
        </SheetHeader>
        {project && (
          <div className="flex flex-col gap-4 mt-4">
            <div>
              <div className="font-semibold">Name:</div>
              <div>{project.name}</div>
            </div>
            <div>
              <div className="font-semibold">Visibility:</div>
              <div>{project.visibility}</div>
            </div>
            <div>
              <div className="font-semibold">Created:</div>
              <div>{new Date(project.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="font-semibold">Vector Collection:</div>
              <div>{project.vectorCollection}</div>
            </div>
            <div>
              <div className="font-semibold">Files:</div>
              {project.files && project.files.length > 0 ? (
                <ul className="list-disc pl-4">
                  {project.files.map((file) => (
                    <li key={file.id} className="mb-1">
                      <span className="font-medium">{file.fileName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(1)} KB</span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground">No files uploaded.</div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
} 