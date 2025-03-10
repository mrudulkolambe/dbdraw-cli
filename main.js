#!/usr/bin/env node

import { Command } from 'commander';
import { intro, text, isCancel, outro, confirm, select, multiselect } from '@clack/prompts';
import chalk from 'chalk';
import keytar from 'keytar';
import fetch from 'node-fetch';
import ora from 'ora';
import isOnline from 'is-online';
import fs from 'fs';
import path from 'path';

const program = new Command();
const SERVICE_NAME = 'dbdraw';
const ACCOUNT_NAME = 'dbdraw_user_account';
const webURL = "https://dbdraw.vercel.app";

const saveToken = async (token) => {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
};

const loadToken = async () => {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
};

const deleteToken = async () => {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
};

const verifyToken = async (token) => {
  try {
    const spinner = ora('Verifying token...').start();

    const response = await fetch(`${webURL}/api/token/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      spinner.fail('Token verification failed.');
      await deleteToken(); // Automatically delete the token if verification fails
      throw new Error(`${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.valid) {
      spinner.fail('Token is invalid or revoked.');
      await deleteToken(); // Automatically delete the token if it's invalid
      throw new Error('Invalid or revoked token');
    }
    
    spinner.succeed('Token verified successfully.');
    return data;
  } catch (error) {
    throw new Error(`Something went wrong, Please try again`);
  }
};

const authenticationFlow = async () => {
  intro(chalk.green('Welcome to the DBDraw CLI'));

  const existingToken = await loadToken();

  if (existingToken) {
    try {
      // Verify if the existing token is still valid
      const online = await isOnline();
      if (online) {
        const data = await verifyToken(existingToken);
        if (data.valid) {
          console.log(chalk.blue(`You are already authenticated as ${data.user.username}.`));
          
          const logout = await confirm({
            message: 'Do you want to log out?',
          });

          if (isCancel(logout)) {
            outro(chalk.yellow('Operation canceled.'));
            process.exit(0);
          }

          if (logout) {
            await deleteToken();
            outro(chalk.green('You have been logged out.'));
            process.exit(0);
          } else {
            outro(chalk.blue('You are still logged in.'));
            process.exit(0);
          }
        }
      }
    } catch (error) {
      // Token verification failed, it's already been deleted in verifyToken
      console.log(chalk.red('Your previous session has expired. Please log in again.'));
      // Continue to login flow
    }
  }

  const token = await text({
    message: 'Enter your access token:',
    placeholder: 'Right-click to paste your token here',
    validate: (value) => (value.trim() ? undefined : 'Token cannot be empty'),
  });

  if (isCancel(token)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  try {
    const online = await isOnline();
    if (!online) {
      outro(chalk.red('No internet connection. Please try again later.'));
      process.exit(1);
    }

    const data = await verifyToken(token);

    if (data.valid) {
      await saveToken(token);
      outro(chalk.green(`Authenticated as ${data.user.username}`));
    } else {
      outro(chalk.red('Invalid token. Please try again.'));
      process.exit(1);
    }
  } catch (error) {
    outro(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
};

const fetchAndSelectProject = async (token) => {
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

const saveConfigFile = async (project) => {
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

program
  .name('dbdraw')
  .description('DBDraw CLI for authentication and database operations')
  .version('1.0.0');

program
  .command('login')
  .description('Login to DBDraw CLI and save access token securely')
  .action(async () => {
    await authenticationFlow();
  });

program
  .command('link')
  .description('Fetch projects, select one, and create a config.json file')
  .action(async () => {
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
  });

function convertJsonToCollectionsFormat(json) {
  try {
    const { edges, nodes } = json;
    const collections = nodes.map((node) => {
      const formattedFields = node.data.fields.map((field, fieldIndex) => {
        const formattedField = {
          name: field.name,
          type: field.type,
          primary: field.type === "primary",
          required: field.required || false,
          unique: field.unique || false,
          default: field.default,
          list: field.list || false,
          id: field.id,
        };

        if (field.type === "ref") {
          const edge = edges.find(
            (edge) => edge.target === node.id && edge.targetHandle === `target-${fieldIndex}`
          );

          if (edge) {
            const targetNode = nodes.find((n) => n.id === edge.source);
            if (targetNode) {
              formattedField.ref = targetNode.data.label;
            }
          }
        }

        return formattedField;
      });

      return {
        collectionName: node.data.label,
        fields: formattedFields,
      };
    });

    return collections;
  } catch (error) {
    console.error("Error reading or converting JSON:", error.message);
    return null;
  }
}

function generateTypeScriptInterfaces(collections) {
  return collections.map(collection => {
    const pascalName = toPascalCase(collection.collectionName);
    const fields = collection.fields
      .filter(field => field.name !== "_id")
      .map(field => {
        let typeStr = '';
        switch (field.type.toLowerCase()) {
          case 'string':
            typeStr = 'string';
            break;
          case 'number':
            typeStr = 'number';
            break;
          case 'boolean':
            typeStr = 'boolean';
            break;
          case 'date':
            typeStr = 'Date';
            break;
          case 'ref':
            typeStr = field.ref ? `Types.ObjectId | ${toPascalCase(field.ref)}` : 'Types.ObjectId';
            break;
          default:
            typeStr = 'any';
        }
        if (field.list) typeStr = `${typeStr}[]`;
        return `  ${field.name}${field.required ? '' : '?'}: ${typeStr};`;
      })
      .join('\n');

    return `interface ${pascalName} extends Document {
${fields}
}`;
  }).join('\n\n');
}

function generateSchemas(collections, type = "all", language = "javascript") {
  const schemas = collections
    .filter((item) => {
      if (type === "all") {
        return item;
      } else {
        return item.collectionName === type;
      }
    });

  if (schemas.length > 0) {
    // Handle TypeScript vs JavaScript imports and interfaces
    let imports = language === 'typescript'
      ? 'import mongoose, { Document, Schema, Types } from "mongoose";\n\n'
      : 'const mongoose = require(\'mongoose\');\n\n';

    let interfaces = '';
    if (language === 'typescript') {
      interfaces = generateTypeScriptInterfaces(schemas) + '\n\n';
    }

    let generatedSchema = schemas.map((collection) => {
      const pascalCaseCollectionName = toPascalCase(collection.collectionName);
      const schemaName = language === 'typescript'
        ? `Schema<${pascalCaseCollectionName}>`
        : 'mongoose.Schema';
      
      const fieldDefinitions = collection.fields
        .filter((field) => field.name !== "_id")
        .map((field) => {
          const fieldOptions = [];

          if (field.type === "ref" && field.ref) {
            fieldOptions.push(
              `type: ${language === 'typescript' ? 'Schema.Types.ObjectId' : 'mongoose.Schema.Types.ObjectId'}`,
              `ref: "${field.ref}"`,
              field.required ? `required: true` : ""
            );
          } else {
            fieldOptions.push(`type: ${mapFieldTypeToMongoose(field.type)}`);
            if (field.required) fieldOptions.push(`required: true`);
            if (field.unique) fieldOptions.push(`unique: true`);
            if (field.default !== undefined)
              fieldOptions.push(`default: ${JSON.stringify(field.default)}`);
            if (field.list) fieldOptions.push(`array: true`);
          }

          return `  ${field.name}: { ${fieldOptions.filter(Boolean).join(", ")} }`;
        });

      if (fieldDefinitions.length === 0) return "";

      const modelType = language === 'typescript'
        ? `mongoose.Model<${pascalCaseCollectionName}>`
        : '';

      const exportStatement = language === 'typescript'
        ? `export const ${pascalCaseCollectionName}${modelType ? `: ${modelType}` : ''} = mongoose.model${language === 'typescript' ? `<${pascalCaseCollectionName}>` : ''}("${collection.collectionName.toLowerCase()}", ${pascalCaseCollectionName}Schema);`
        : `module.exports = mongoose.model("${collection.collectionName.toLowerCase()}", ${pascalCaseCollectionName}Schema);`;

      return `const ${pascalCaseCollectionName}Schema = new ${language === 'typescript' ? 'Schema' : 'mongoose.Schema'}({
${fieldDefinitions.join(",\n")}
});
      
${exportStatement}
        `;
    }).filter(Boolean).join("\n");

    return `${imports}${interfaces}${generatedSchema}`;
  } else {
    return null;
  }
}

function mapFieldTypeToMongoose(type) {
  switch (type.toLowerCase()) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    case "date":
      return "Date";
    case "ref":
      return "mongoose.Schema.Types.ObjectId";
    default:
      return "String";
  }
}

function toPascalCase(str) {
  return str
    .replace(/(^|_|\s)([a-z])/g, (_, __, letter) => letter.toUpperCase())
    .replace(/[_\s]/g, '');
}

const saveSchemas = async (collections, savePath, selectedModels, language = "javascript") => {
  const modelsDir = path.resolve(savePath);
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  collections.forEach((collection) => {
    if (selectedModels.includes('all') || selectedModels.includes(collection.collectionName)) {
      const schemasCode = generateSchemas([collection], 'all', language);
      if (schemasCode) {
        const fileExtension = language === 'typescript' ? '.ts' : '.js';
        const fileName = `${toPascalCase(collection.collectionName)}${fileExtension}`;
        const filePath = path.join(modelsDir, fileName);
        fs.writeFileSync(filePath, schemasCode, 'utf8');
      } else {
        console.log(chalk.yellow(`Skipped schema generation for: ${collection.collectionName}`));
      }
    }
  });
};

program
  .command('sync')
  .description('Sync the project, validate the configuration, and generate schemas')
  .action(async () => {
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
  });

program.parse(process.argv);
