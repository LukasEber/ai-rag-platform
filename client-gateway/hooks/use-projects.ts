import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, ProjectWithFiles, ProjectFormData } from '@/types/project';
import { fetchWithErrorHandlers } from '@/lib/utils';
import { toast } from '@/components/toast';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexingProjects, setIndexingProjects] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Separate loading states for different operations
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers('/api/project', { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load projects.');
      const data = await res.json();
      setProjects(data);
      
      // Update indexing projects set
      const notIndexedProjects = data.filter((p: Project) => !p.isIndexed).map((p: Project) => p.id);
      setIndexingProjects(new Set(notIndexedProjects));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIndexingStatus = useCallback(async () => {
    try {
      const res = await fetchWithErrorHandlers('/api/project/indexing-status', { method: 'GET' });
      if (!res.ok) return;
      
      const statusData = await res.json();
      const updatedProjects = projects.map(project => {
        const status = statusData.find((s: any) => s.projectId === project.id);
        return status ? { ...project, isIndexed: status.isIndexed } : project;
      });
      
      // Check for newly completed projects
      const previouslyIndexing = Array.from(indexingProjects);
      const newlyCompleted = previouslyIndexing.filter(projectId => {
        const project = updatedProjects.find(p => p.id === projectId);
        return project && project.isIndexed;
      });
      
      // Show toast for completed projects
      newlyCompleted.forEach(projectId => {
        const project = updatedProjects.find(p => p.id === projectId);
        if (project) {
          toast({ 
            type: "success", 
            description: `Project "${project.name}" is now fully indexed and ready to use.` 
          });
        }
      });
      
      setProjects(updatedProjects);
      
      // Update indexing projects set
      const notIndexedProjects = updatedProjects.filter(p => !p.isIndexed).map(p => p.id);
      setIndexingProjects(new Set(notIndexedProjects));
    } catch (e) {
      console.error('Failed to check indexing status:', e);
    }
  }, [projects, indexingProjects]);

  // Start polling when there are indexing projects
  useEffect(() => {
    if (indexingProjects.size > 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(checkIndexingStatus, 5000); // Poll every 5 seconds
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [indexingProjects, checkIndexingStatus]);

  const createProject = useCallback(async (form: ProjectFormData) => {
    setCreateLoading(true);
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
      
      const newProject = await res.json();
      
      // Optimistic update - add project with isIndexed: false
      // Use queueMicrotask to ensure UI updates happen asynchronously
      queueMicrotask(() => {
        setProjects(prev => [newProject, ...prev]);
        setIndexingProjects(prev => new Set([...prev, newProject.id]));
      });
      
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setCreateLoading(false);
    }
  }, []);

  const updateProject = useCallback(async (projectId: string, form: ProjectFormData) => {
    setUpdateLoading(true);
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
      
      const updatedProjectData = await res.json();
      
      // If new files were added, mark project as not indexed and start polling
      if (form.files.length > 0) {
        // Optimistic update - mark project as not indexed
        queueMicrotask(() => {
          setProjects(prev => prev.map(p => 
            p.id === projectId 
              ? { ...p, isIndexed: false }
              : p
          ));
          setIndexingProjects(prev => new Set([...prev, projectId]));
        });
      } else {
        // No new files, just update the project data
        queueMicrotask(() => {
          setProjects(prev => prev.map(p => 
            p.id === projectId 
              ? { ...p, name: form.name, visibility: form.visibility }
              : p
          ));
        });
      }
      
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setUpdateLoading(false);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    setDeleteLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers(`/api/project?id=${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete project.');
      
      // Optimistic update - remove project from list
      queueMicrotask(() => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setIndexingProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      });
      
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setDeleteLoading(false);
    }
  }, []);

  const fetchProjectDetails = useCallback(async (projectId: string): Promise<ProjectWithFiles | null> => {
    setDetailsLoading(true);
    setError(null);
    try {
      const res = await fetchWithErrorHandlers(`/api/project?id=${projectId}`, { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load project details.');
      return await res.json();
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  return {
    projects,
    loading,
    error,
    indexingProjects,
    createLoading,
    updateLoading,
    deleteLoading,
    detailsLoading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectDetails,
  };
} 