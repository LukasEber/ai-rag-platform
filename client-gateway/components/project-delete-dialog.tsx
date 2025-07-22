import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetFooter } from './ui/sheet';
import { Button } from './ui/button';

interface ProjectDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export function ProjectDeleteDialog({ open, onOpenChange, loading, onDelete, onClose }: ProjectDeleteDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg w-full">
        <SheetHeader>
          <h2 className="text-xl font-semibold">Delete Project</h2>
        </SheetHeader>
        <div className="mt-4 mb-4">
          Are you sure you want to delete this project? This action cannot be undone.
        </div>
        <SheetFooter>
          <Button variant="destructive" onClick={onDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 