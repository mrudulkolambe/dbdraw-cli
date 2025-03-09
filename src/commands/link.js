import chalk from 'chalk';
import { outro } from '@clack/prompts';
import { loadToken } from '../services/auth.js';
import { fetchAndSelectProject, saveConfigFile } from '../services/project.js';

export const linkCommand = {
  name: 'link',
  description: 'Fetch projects, select one, and create a config.json file',
  action: async () => {
    try {
      const token = await loadToken();

      if (!token) {
        outro(chalk.red('You are not authenticated. Please log in first.'));
        process.exit(1);
      }

      const selectedProject = await fetchAndSelectProject(token);
      await saveConfigFile(selectedProject);
    } catch (error) {
      outro(chalk.red(error.message));
      process.exit(1);
    }
  }
};
