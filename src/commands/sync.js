import { syncProject } from '../services/project.js';

export const syncCommand = {
  name: 'sync',
  description: 'Sync the project, validate the configuration, and generate schemas',
  action: async () => {
    await syncProject();
  }
};
