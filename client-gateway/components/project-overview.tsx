"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/toast";
import { ProjectDataGrid } from './project-data-grid';
import { ProjectViewDialog } from './project-view-dialog';
import { ProjectEditDialog } from './project-edit-dialog';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
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
    createLoading,
    updateLoading,
    deleteLoading,
    detailsLoading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectDetails,
  } = useProjects();
  const [dialog, setDialog] = useState<DialogState>({ type: null });

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handlers
  const handleViewProject = async (project: Project) => {
    console.log('project', project);
    try {
      const details = await fetchProjectDetails(project.id);
      console.log('project details', details);
      if (details) {
        setDialog({ type: 'view', project: details });
      } else {
        toast({ type: "error", description: "Failed to load project details." });
      }
    } catch (e) {
      toast({ type: "error", description: "Failed to load project details." });
    }
  };
  const handleEditProject = async (project: Project) => {
    // Prevent editing if project is still indexing
    if (!project.isIndexed) {
      toast({ type: "error", description: "Project cannot be edited while indexing is in progress." });
      return;
    }
    
    try {
      const details = await fetchProjectDetails(project.id);
      if (details) {
        setDialog({ type: 'edit', project: details });
      } else {
        toast({ type: "error", description: "Failed to load project details." });
      }
    } catch (e) {
      toast({ type: "error", description: "Failed to load project details." });
    }
  };
  const handleDeleteProject = (project: Project) => {
    // Prevent deleting if project is still indexing
    if (!project.isIndexed) {
      toast({ type: "error", description: "Project cannot be deleted while indexing is in progress." });
      return;
    }
    
    setDialog({ type: 'delete', projectId: project.id });
  };
  const handleCreateProject = () => {
    setDialog({ type: 'create' });
  };

  // Dialog actions
  const handleCreate = async (form: ProjectFormData) => {
    try {
      const ok = await createProject(form);
      if (ok) {
        toast({ type: "success", description: "Project created! Indexing started in the background." });
        setDialog({ type: null });
      } else {
        toast({ type: "error", description: error || "Failed to create project." });
      }
    } catch (e) {
      toast({ type: "error", description: "Failed to create project." });
    }
  };
  const handleEdit = async (form: ProjectFormData) => {
    if (dialog.type !== 'edit') return;
    try {
      const ok = await updateProject(dialog.project.id, form);
      if (ok) {
        if (form.files.length > 0) {
          toast({ type: "success", description: "Project updated! New files are being indexed in the background." });
        } else {
          toast({ type: "success", description: "Project updated!" });
        }
        setDialog({ type: null });
      } else {
        toast({ type: "error", description: error || "Failed to update project." });
      }
    } catch (e) {
      toast({ type: "error", description: "Failed to update project." });
    }
  };
  const handleDelete = async () => {
    if (dialog.type !== 'delete') return;
    try {
      const ok = await deleteProject(dialog.projectId);
      if (ok) {
        toast({ type: "success", description: "Project deleted!" });
        setDialog({ type: null });
      } else {
        toast({ type: "error", description: error || "Failed to delete project." });
      }
    } catch (e) {
      toast({ type: "error", description: "Failed to delete project." });
    }
  };
  const handleRemoveFile = async (fileId: string) => {
    if (dialog.type !== 'edit') return;
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
        loading={createLoading}
        onCreate={handleCreate}
        onClose={() => setDialog({ type: null })}
      />
      {/* Edit Dialog */}
      <ProjectEditDialog
        open={dialog.type === 'edit'}
        onOpenChange={open => setDialog(open && dialog.type === 'edit' && dialog.project ? dialog : { type: null })}
        project={dialog.type === 'edit' ? dialog.project : null}
        loading={updateLoading || detailsLoading}
        onSave={handleEdit}
        onRemoveFile={handleRemoveFile}
        onClose={() => setDialog({ type: null })}
      />
      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        isOpen={dialog.type === 'delete'}
        onClose={() => setDialog({ type: null })}
        onConfirm={handleDelete}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        type="project"
      />
    </div>
  );
} 