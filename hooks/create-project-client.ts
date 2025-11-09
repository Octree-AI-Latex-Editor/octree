'use client';

import { createProject } from '../actions/create-project';
import { useProjectRefresh } from '@/app/context/project';

export function useCreateProject() {
  const { refreshProjects } = useProjectRefresh();

  const createProjectWithRefresh = async (formData: FormData) => {
    const result = await createProject({ projectId: null }, formData);

    if (result.success) {
      refreshProjects();
    }

    return result;
  };

  return { createProjectWithRefresh };
}
