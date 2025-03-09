import { text, isCancel, outro, confirm, select, multiselect } from '@clack/prompts';
import chalk from 'chalk';
import fetch from 'node-fetch';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { webURL } from '../utils/constants.js';
import { loadToken } from './auth.js';
import { convertJsonToCollectionsFormat, saveSchemas } from './schema.js';

export const fetchAndSelectProject = async (token) => {
  const currentDir = process.cwd();
  const packageJsonPath = path.join(currentDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    outro(chalk.red('This is not a backend folder. Please navigate to a valid backend folder.'));
    process.exit(1);
  }

  const spinner = ora('Fetching projects...').start();

  try {
    const response = await fetch(`${webURL}/api/token/validate/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const projectsResponse = await response.json();

    if (!projectsResponse.valid) {
      spinner.fail(chalk.red(projectsResponse.message));
      process.exit(1);
    }
    spinner.stop()
    const projectChoices = projectsResponse.projects.map((project) => ({
      value: project._id,
      label: `${project.title} (ID: ${project._id})`,
    }));

    const selectedProjectId = await select({
      message: 'Select a Project:',
      options: projectChoices,
    });

    if (isCancel(selectedProjectId)) {
      outro(chalk.yellow('Operation canceled.'));
      process.exit(0);
    }

    const selectedProject = projectsResponse.projects.find((project) => project._id === selectedProjectId);

    return selectedProject;
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch projects.'));
    process.exit(1);
  }
};

export const saveConfigFile = async (project) => {
  const configPath = path.resolve('.dbdraw/config.json');

  const savePathResponse = await text({
    message: 'Where should the files be saved?',
    placeholder: './models',
    defaultValue: './models',
  });

  if (isCancel(savePathResponse)) {
    outro(chalk.yellow('Operation canceled.'));
    return;
  }

  const savePath = savePathResponse.trim() || './models';

  const languageChoice = await select({
    message: 'Choose the project language:',
    options: [
      { value: 'typescript', label: 'TypeScript' },
      { value: 'javascript', label: 'JavaScript' },
    ],
    required: true,
  });

  if (isCancel(languageChoice)) {
    outro(chalk.yellow('Operation canceled.'));
    return;
  }

  const language = languageChoice === 'typescript' ? true : false;
  let moduleType = 'module'; // Default to ES Module for TypeScript

  // Only ask for module type if JavaScript is selected
  if (languageChoice === 'javascript') {
    const moduleTypeChoice = await select({
      message: 'Choose the module system:',
      options: [
        { value: 'commonjs', label: 'CommonJS' },
        { value: 'module', label: 'ES Module' },
      ],
      required: true,
    });

    if (isCancel(moduleTypeChoice)) {
      outro(chalk.yellow('Operation canceled.'));
      return;
    }

    moduleType = moduleTypeChoice;
  }

  const configData = {
    projectID: `prj-${project._id}`,
    path: savePath,
    language: languageChoice,
    type: moduleType,
    updatedAt: Date.now(),
  };

  const dirPath = path.dirname(configPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (fs.existsSync(configPath)) {
    const overwrite = await confirm({
      message: 'Config file already exists. Do you want to overwrite it?',
    });

    if (isCancel(overwrite)) {
      outro(chalk.yellow('Operation canceled.'));
      return;
    }

    if (!overwrite) {
      outro(chalk.yellow('Operation canceled.'));
      return;
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  outro(chalk.green('Project linked successfully!'));
};

export const syncProject = async () => {
  try {
    const token = await loadToken();
    if (!token) {
      console.log(chalk.red('You are not authenticated. Please log in first.'));
      process.exit(1);
    }

    const configPath = path.resolve('.dbdraw/config.json');

    if (!fs.existsSync(configPath)) {
      console.log(chalk.blue('Invalid config. Use "dbdraw link" to link your project.'));
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const { projectID, path: configPath2 = './models', language = 'javascript' } = config;
    const savePath = configPath2;

    const isValidProjectId = typeof projectID === 'string' && projectID.startsWith('prj-') && projectID.length === 28;

    if (!isValidProjectId) {
      console.log(chalk.blue('Invalid config. Use "dbdraw link" to link your project.'));
      process.exit(1);
    }

    const spinner = ora('Syncing project...').start();

    const response = await fetch(`${webURL}/api/token/validate/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ project: projectID }),
    });

    if (!response.ok) {
      spinner.fail(chalk.red('Failed to sync the project.'));
      const errorData = await response.json();
      console.error(chalk.red(`Error: ${errorData.message}`));
      process.exit(1);
    }

    const data = await response.json();
    if (data.valid) {
      const flowData = data.project.flow;
      const collections = convertJsonToCollectionsFormat(flowData);

      if (!collections) {
        spinner.fail(chalk.red('Failed to generate collections from the flow data.'));
        process.exit(1);
      }

      // Stop the spinner before showing the multiselect prompt
      spinner.stop();

      const availableModels = collections.map((collection) => collection.collectionName);
      const selectedModels = await multiselect({
        message: 'Select models to sync:',
        options: [
          { value: 'all', label: 'All Models' },
          ...availableModels.map((model) => ({ value: model, label: model })),
        ],
        required: true,
      });

      if (isCancel(selectedModels)) {
        console.log(chalk.yellow('Operation canceled.'));
        return;
      }

      // Restart the spinner for the file operations
      spinner.start('Generating schema files...');

      const modelsDir = path.resolve(savePath);

      if (fs.existsSync(modelsDir)) {
        // Stop spinner for user interaction
        spinner.stop();
        
        const overwrite = await confirm({
          message: 'Target folder already exists. Do you want to overwrite it?',
        });

        if (isCancel(overwrite)) {
          outro(chalk.yellow('Operation canceled.'));
          return;
        }

        if (!overwrite) {
          outro(chalk.yellow('Operation canceled.'));
          return;
        }
        
        // Restart spinner after user interaction
        spinner.start('Generating schema files...');
      }

      await saveSchemas(collections, savePath, selectedModels, language);
      spinner.succeed(chalk.green(`Project synced successfully: ${data.project.title}`));
    } else {
      spinner.fail(chalk.red(data.message));
      process.exit(1);
    }
  } catch (error) {
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
};
