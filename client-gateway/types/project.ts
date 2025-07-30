// Project-related types for use across the app

export interface Project {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  createdAt: string;
  vectorCollection: string;
  isIndexed: boolean;
}

export interface ProjectFile {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  indexingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProjectWithFiles extends Project {
  files: ProjectFile[];
}

export interface ProjectFormData {
  name: string;
  visibility: 'public' | 'private';
  files: File[];
} 