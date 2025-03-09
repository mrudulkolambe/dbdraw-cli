import { generateApiProject } from '../services/api-generator.js';
import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';

export const generateCommand = {
  name: 'generate',
  description: 'Generate a complete API project from your DrawDB schema',
  action: async () => {
    intro(chalk.blue('🚀 DrawDB API Generator'));
    
    try {
      await generateApiProject();
    } catch (error) {
      outro(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }
};
