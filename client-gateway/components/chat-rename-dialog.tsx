'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit3, MessageSquare } from 'lucide-react';
import { toast } from '@/components/toast';

interface ChatRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newTitle: string) => Promise<void>;
  currentTitle: string;
  chatId: string;
}

export function ChatRenameDialog({
  isOpen,
  onClose,
  onConfirm,
  currentTitle,
  chatId
}: ChatRenameDialogProps) {
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!newTitle.trim()) {
      setError('Chat title cannot be empty');
      return;
    }

    if (newTitle.trim() === currentTitle) {
      onClose();
      return;
    }

    if (newTitle.length > 100) {
      setError('Chat title must be less than 100 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onConfirm(newTitle.trim());
      toast({ type: 'success', description: 'Chat renamed successfully!' });
      onClose();
    } catch (error) {
      setError('Failed to rename chat. Please try again.');
      toast({ type: 'error', description: 'Failed to rename chat' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewTitle(currentTitle);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <Edit3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white mt-4 text-center">
            Rename Chat
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 text-center">
            Give your chat a new name to help you find it later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="chat-title" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Chat Title
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MessageSquare className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                id="chat-title"
                type="text"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder="Enter new chat title..."
                className="pl-10"
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {newTitle.length}/100 characters
            </p>
          </div>

          {newTitle.trim() !== currentTitle && (
            <div className="bg-gray-50 dark:bg-gray-900/10 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="h-4 w-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <p className="font-medium">Preview:</p>
                  <p className="mt-1">
                    <span className="text-gray-500 dark:text-gray-400">From:</span> &quot;{currentTitle}&quot;
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">To:</span> &quot;{newTitle.trim()}&quot;
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !newTitle.trim() || newTitle.trim() === currentTitle}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Renaming...
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename Chat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
