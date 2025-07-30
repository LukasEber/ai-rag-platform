"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/toast";
import { ProjectDataGrid } from './project-data-grid';
import { ProjectViewDialog } from './project-view-dialog';
import { ProjectEditDialog } from './project-edit-dialog';
import { ProjectDeleteDialog } from './project-delete-dialog';
import { ProjectCreateDialog } from './project-create-dialog';
import { useProjects } from '@/hooks/use-projects';
import { Project, ProjectWithFiles, ProjectFormData } from '@/types/project';

type DialogState =
  | { type: null }
  | { type: 'view', project: ProjectWithFiles }
  | { type: 'edit', project: ProjectWithFiles }
  | { type: 'delete', projectId: string }
  | { type: 'create' };

export function ProjectOverview() {
  const {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectDetails,
  } = useProjects();
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handlers
  const handleViewProject = async (project: Project) => {
    setSubmitting(true);
    const details = await fetchProjectDetails(project.id);
    setSubmitting(false);
    if (details) {
      setDialog({ type: 'view', project: details });
    } else {
      toast({ type: "error", description: "Failed to load project details." });
    }
  };
  const handleEditProject = async (project: Project) => {
    setSubmitting(true);
    const details = await fetchProjectDetails(project.id);
    setSubmitting(false);
    if (details) {
      setDialog({ type: 'edit', project: details });
    } else {
      toast({ type: "error", description: "Failed to load project details." });
    }
  };
  const handleDeleteProject = (project: Project) => {
    setDialog({ type: 'delete', projectId: project.id });
  };
  const handleCreateProject = () => {
    setDialog({ type: 'create' });
  };

  // Dialog actions
  const handleCreate = async (form: ProjectFormData) => {
    setSubmitting(true);
    const ok = await createProject(form);
    setSubmitting(false);
    if (ok) {
      toast({ type: "success", description: "Projekt wird erstellt... Indexierung startet im Hintergrund." });
      setDialog({ type: null });
    } else {
      toast({ type: "error", description: error || "Failed to create project." });
    }
  };
  const handleEdit = async (form: ProjectFormData) => {
    if (dialog.type !== 'edit') return;
    setSubmitting(true);
    const ok = await updateProject(dialog.project.id, form);
    setSubmitting(false);
    if (ok) {
      if (form.files.length > 0) {
        toast({ type: "success", description: "Projekt aktualisiert... Neue Dateien werden im Hintergrund indexiert." });
      } else {
        toast({ type: "success", description: "Projekt aktualisiert!" });
      }
      setDialog({ type: null });
    } else {
      toast({ type: "error", description: error || "Failed to update project." });
    }
  };
  const handleDelete = async () => {
    if (dialog.type !== 'delete') return;
    setSubmitting(true);
    const ok = await deleteProject(dialog.projectId);
    setSubmitting(false);
    if (ok) {
      toast({ type: "success", description: "Project deleted!" });
      setDialog({ type: null });
    } else {
      toast({ type: "error", description: error || "Failed to delete project." });
    }
  };
  const handleRemoveFile = async (fileId: string) => {
    if (dialog.type !== 'edit') return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/project?id=${dialog.project.id}&fileId=${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete file');
      toast({ type: 'success', description: 'File deleted!' });
      // Refresh project details
      const details = await fetchProjectDetails(dialog.project.id);
      if (details) setDialog({ type: 'edit', project: details });
    } catch (e) {
      toast({ type: 'error', description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Button variant="default" onClick={handleCreateProject}>Add Project</Button>
      </div>
      <Separator className="mb-6" />
      {/* DataGrid Table */}
      <ProjectDataGrid
        projects={projects}
        loading={loading}
        onView={handleViewProject}
        onEdit={handleEditProject}
        onDelete={handleDeleteProject}
      />
      {/* View Dialog */}
      <ProjectViewDialog
        open={dialog.type === 'view'}
        onOpenChange={open => setDialog(open && dialog.type === 'view' && dialog.project ? dialog : { type: null })}
        project={dialog.type === 'view' ? dialog.project : null}
        onClose={() => setDialog({ type: null })}
      />
      {/* Create Dialog */}
      <ProjectCreateDialog
        open={dialog.type === 'create'}
        onOpenChange={open => setDialog(open ? { type: 'create' } : { type: null })}
        loading={submitting}
        onCreate={handleCreate}
        onClose={() => setDialog({ type: null })}
      />
      {/* Edit Dialog */}
      <ProjectEditDialog
        open={dialog.type === 'edit'}
        onOpenChange={open => setDialog(open && dialog.type === 'edit' && dialog.project ? dialog : { type: null })}
        project={dialog.type === 'edit' ? dialog.project : null}
        loading={submitting}
        onSave={handleEdit}
        onRemoveFile={handleRemoveFile}
        onClose={() => setDialog({ type: null })}
      />
      {/* Delete Dialog */}
      <ProjectDeleteDialog
        open={dialog.type === 'delete'}
        onOpenChange={open => setDialog(open && dialog.type === 'delete' && dialog.projectId ? dialog : { type: null })}
        loading={submitting}
        onDelete={handleDelete}
        onClose={() => setDialog({ type: null })}
      />
    </div>
  );
} 