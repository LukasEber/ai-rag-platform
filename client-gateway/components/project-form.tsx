import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { ChevronDownIcon, GlobeIcon, LockIcon } from './icons';
import { ProjectFormData } from '@/types/project';

const VISIBILITY_OPTIONS = [
  { id: 'private', label: 'Private', icon: <LockIcon size={16} /> },
  { id: 'public', label: 'Public', icon: <GlobeIcon size={16} /> },
] as const;

type ProjectFormProps = {
  initial?: Partial<ProjectFormData>;
  loading?: boolean;
  onSubmit: (form: ProjectFormData) => void;
  submitLabel: string;
  allowMultipleFiles?: boolean;
};

export function ProjectForm({ initial, loading, onSubmit, submitLabel, allowMultipleFiles }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormData>({
    name: initial?.name || '',
    visibility: initial?.visibility || 'private',
    files: [],
  });
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);

  useEffect(() => {
    setForm({
      name: initial?.name || '',
      visibility: initial?.visibility || 'private',
      files: [],
    });
  }, [initial]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      setForm((f) => ({ ...f, files: files ? Array.from(files) : [] }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          name="name"
          value={form.name}
          onChange={handleFormChange}
          required
          disabled={loading}
          className="mt-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="visibility">Visibility</Label>
        <DropdownMenu open={visibilityDropdownOpen} onOpenChange={setVisibilityDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="justify-between w-full"
              disabled={loading}
            >
              <span className="flex items-center gap-2">
                {VISIBILITY_OPTIONS.find(v => v.id === form.visibility)?.icon}
                {VISIBILITY_OPTIONS.find(v => v.id === form.visibility)?.label}
              </span>
              <span style={{ marginLeft: 8 }}><ChevronDownIcon size={16} /></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            {VISIBILITY_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onSelect={() => {
                  setForm((f) => ({ ...f, visibility: option.id as 'private' | 'public' }));
                  setVisibilityDropdownOpen(false);
                }}
                className="flex items-center gap-2"
                data-active={form.visibility === option.id}
              >
                {option.icon}
                <span>{option.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">Upload File{allowMultipleFiles ? 's (multiple allowed)' : ' (optional)'}</Label>
        <Input
          id="file"
          name="files"
          type="file"
          accept=".txt,.pdf"
          multiple={!!allowMultipleFiles}
          onChange={handleFormChange}
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? submitLabel + '...' : submitLabel}
      </Button>
    </form>
  );
} 