import { useState, useCallback } from 'react';
import { Project, ProjectWithFiles, ProjectFormData } from '@/types/project';
import { fetchWithErrorHandlers } from '@/lib/utils';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers('/api/project', { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load projects.');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (form: ProjectFormData) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('visibility', form.visibility);
      for (const file of form.files) {
        formData.append('files', file);
      }
      const res = await fetchWithErrorHandlers('/api/project', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to create project.');
      await fetchProjects();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProjects]);

  const updateProject = useCallback(async (projectId: string, form: ProjectFormData) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('id', projectId);
      formData.append('name', form.name);
      formData.append('visibility', form.visibility);
      for (const file of form.files) {
        formData.append('files', file);
      }
      const res = await fetchWithErrorHandlers('/api/project', {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to update project.');
      await fetchProjects();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers(`/api/project?id=${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete project.');
      await fetchProjects();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProjects]);

  const fetchProjectDetails = useCallback(async (projectId: string): Promise<ProjectWithFiles | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers(`/api/project?id=${projectId}`, { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load project details.');
      return await res.json();
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectDetails,
  };
} 