import React from 'react';
import { Sheet, SheetContent, SheetHeader } from './ui/sheet';
import { ProjectWithFiles } from '@/types/project';
import { Badge } from '@/components/ui/badge';

interface ProjectViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithFiles | null;
  onClose: () => void;
}

// Helper function to get status color and text
const getStatusInfo = (status: string) => {
  switch (status) {
    case 'completed':
      return { 
        color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800', 
        text: 'Indexiert' 
      };
    case 'completedWithoutData':
      return { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800', 
        text: 'Kein Text' 
      };
    case 'failed':
      return { 
        color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', 
        text: 'Indexierung fehlgeschlagen' 
      };
    case 'processing':
      return { 
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', 
        text: 'Wird indexiert...' 
      };
    case 'pending':
      return { 
        color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', 
        text: 'Ausstehend' 
      };
    default:
      return { 
        color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', 
        text: 'Unbekannt' 
      };
  }
};

export function ProjectViewDialog({ open, onOpenChange, project, onClose }: ProjectViewDialogProps) {
  console.log('project in view dialog', project);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg w-full flex flex-col">
        <SheetHeader>
          <h2 className="text-xl font-semibold">Project Details</h2>
        </SheetHeader>
        {project && (
          <div className="flex flex-col gap-4 mt-4 flex-1 overflow-hidden">
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
            <div className="flex-1 flex flex-col min-h-0">
              <div className="font-semibold mb-2">Files:</div>
              {project.files && project.files.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                  <ul className="space-y-2">
                    {project.files.map((file) => {
                      const statusInfo = getStatusInfo(file.indexingStatus || 'pending');
                      return (
                        <li key={file.id} className="flex flex-col gap-1 p-2 border rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{file.fileName}</span>
                            <Badge className={`text-xs ${statusInfo.color}`}>
                              {statusInfo.text}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{(file.fileSize / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{new Date(file.createdAt).toLocaleString()}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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