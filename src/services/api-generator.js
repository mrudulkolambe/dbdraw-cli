import { text, isCancel, outro, confirm, select, multiselect } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import fetch from 'node-fetch';
import { webURL } from '../utils/constants.js';
import { convertJsonToCollectionsFormat } from './schema.js';
import { loadToken } from './auth.js';
import { generateModel } from './api-generator/generators/model-generator.js';
import { generateController } from './api-generator/generators/controller-generator.js';
import { generateRoute } from './api-generator/generators/route-generator.js';
import { writeFileSafely } from './api-generator/utils.js';
import {
  packageJsonTemplate,
  envTemplate,
  dockerfileTemplate,
  dockerComposeTemplate,
  gitignoreTemplate,
  readmeTemplate,
  tsConfigTemplate,
  jestConfigTemplate
} from './api-generator/templates.js';

export const generateApiProject = async () => {
  try {
    // 1. Load auth token and validate
    const token = await loadToken();
    if (!token) {
      outro(chalk.red('You are not authenticated. Please login first using: dbdraw login'));
      process.exit(1);
    }

    // 2. Fetch and select project
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

      spinner.stop();

      const projectChoices = projectsResponse.projects.map((project) => ({
        value: project,
        label: `${project.title} (ID: ${project._id})`,
      }));

      const selectedProject = await select({
        message: 'Select a Project:',
        options: projectChoices,
      });

      if (isCancel(selectedProject)) {
        outro(chalk.yellow('Operation canceled.'));
        process.exit(0);
      }

      // 3. Get project configuration
      const config = await getProjectConfig();
      
      // 4. Create project structure
      await createProjectStructure(config);

      // 5. Generate API code
      await generateApiCode(selectedProject, config);

      outro(chalk.green('✨ API project generated successfully!'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch projects'));
      throw error;
    }
  } catch (error) {
    outro(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
};

const getProjectConfig = async () => {
  // Get project name
  const projectName = await text({
    message: 'Enter your project name:',
    placeholder: 'my-api',
    validate: (value) => {
      if (!value) return 'Project name is required';
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Project name can only contain lowercase letters, numbers, and hyphens';
      }
      if (fs.existsSync(path.join(process.cwd(), value))) {
        return 'A directory with this name already exists';
      }
    },
  });

  if (isCancel(projectName)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  // Select language
  const language = await select({
    message: 'Choose the project language:',
    options: [
      { value: 'typescript', label: 'TypeScript' },
      { value: 'javascript', label: 'JavaScript' },
    ],
  });

  if (isCancel(language)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  // Select features
  const features = await multiselect({
    message: 'Select additional features:',
    options: [
      { value: 'auth', label: 'Authentication', hint: 'JWT-based auth' },
      { value: 'swagger', label: 'Swagger Documentation', hint: 'API docs' },
      { value: 'docker', label: 'Docker Setup', hint: 'Containerization' },
      { value: 'tests', label: 'Unit Tests', hint: 'Jest testing setup' },
    ],
    required: false,
  });

  if (isCancel(features)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  // Get output directory
  const defaultOutputDir = path.join(process.cwd(), projectName);
  const outputDir = await text({
    message: 'Where should the project be generated?',
    placeholder: defaultOutputDir,
    defaultValue: defaultOutputDir,
    validate: (value) => {
      if (!value) return 'Output directory is required';
      if (fs.existsSync(value)) {
        return 'Directory already exists';
      }
    },
  });

  if (isCancel(outputDir)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  return {
    projectName,
    language,
    features: new Set(features),
    outputDir: outputDir || defaultOutputDir,
  };
};

const createProjectStructure = async (config) => {
  const spinner = ora('Creating project structure...').start();
  try {
    // Create base directories
    const dirs = [
      config.outputDir,
      path.join(config.outputDir, 'src'),
      path.join(config.outputDir, 'src/models'),
      path.join(config.outputDir, 'src/controllers'),
      path.join(config.outputDir, 'src/routes'),
      path.join(config.outputDir, 'src/middleware'),
      path.join(config.outputDir, 'src/config'),
      path.join(config.outputDir, 'src/utils'),
    ];

    if (config.features.has('tests')) {
      dirs.push(path.join(config.outputDir, 'tests'));
      dirs.push(path.join(config.outputDir, 'tests/unit'));
      dirs.push(path.join(config.outputDir, 'tests/integration'));
    }

    // Create all directories
    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Create base files
    const extension = config.language === 'typescript' ? 'ts' : 'js';
    
    // Generate package.json
    await writeFileSafely(
      path.join(config.outputDir, 'package.json'),
      packageJsonTemplate(config)
    );

    // Generate .env and example
    await writeFileSafely(
      path.join(config.outputDir, '.env'),
      envTemplate(config)
    );
    await writeFileSafely(
      path.join(config.outputDir, '.env.example'),
      envTemplate(config)
    );

    // Generate .gitignore
    await writeFileSafely(
      path.join(config.outputDir, '.gitignore'),
      gitignoreTemplate()
    );

    // Generate README.md
    await writeFileSafely(
      path.join(config.outputDir, 'README.md'),
      readmeTemplate(config)
    );

    // Generate Docker files if needed
    if (config.features.has('docker')) {
      await writeFileSafely(
        path.join(config.outputDir, 'Dockerfile'),
        dockerfileTemplate(config)
      );
      await writeFileSafely(
        path.join(config.outputDir, 'docker-compose.yml'),
        dockerComposeTemplate(config)
      );
    }

    // Generate TypeScript config if needed
    if (config.language === 'typescript') {
      await writeFileSafely(
        path.join(config.outputDir, 'tsconfig.json'),
        tsConfigTemplate()
      );
    }

    // Generate Jest config if tests are enabled
    if (config.features.has('tests')) {
      await writeFileSafely(
        path.join(config.outputDir, 'jest.config.js'),
        jestConfigTemplate(config)
      );
    }

    spinner.succeed(chalk.green('Project structure created successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create project structure'));
    throw error;
  }
};

const generateApiCode = async (project, config) => {
  const spinner = ora('Generating API code...').start();
  
  try {
    // Convert the project schema to our collection format
    const collections = convertJsonToCollectionsFormat(project.flow);
    
    // Generate models, controllers, and routes
    for (const collection of collections) {
      // Generate model
      const model = generateModel(collection, config);
      writeFileSafely(
        fs,
        path.join(config.outputDir, 'src/models', model.fileName),
        model.content
      );

      // Generate controller
      const controller = generateController(collection, config);
      writeFileSafely(
        fs,
        path.join(config.outputDir, 'src/controllers', controller.fileName),
        controller.content
      );

      // Generate route
      const route = generateRoute(collection, config);
      writeFileSafely(
        fs,
        path.join(config.outputDir, 'src/routes', route.fileName),
        route.content
      );
    }

    // Generate configuration files
    await generateConfigFiles(config);

    // Generate base files
    await generateBaseFiles(collections, config);

    spinner.succeed('API code generated successfully');
  } catch (error) {
    spinner.fail('Failed to generate API code');
    throw error;
  }
};

const generateConfigFiles = async (config) => {
  // package.json
  writeFileSafely(
    fs,
    path.join(config.outputDir, 'package.json'),
    JSON.stringify(packageJsonTemplate(config), null, 2)
  );

  // .env and .env.example
  writeFileSafely(
    fs,
    path.join(config.outputDir, '.env'),
    envTemplate()
  );
  writeFileSafely(
    fs,
    path.join(config.outputDir, '.env.example'),
    envTemplate()
  );

  // .gitignore
  writeFileSafely(
    fs,
    path.join(config.outputDir, '.gitignore'),
    gitignoreTemplate()
  );

  // README.md
  writeFileSafely(
    fs,
    path.join(config.outputDir, 'README.md'),
    readmeTemplate(config)
  );

  // TypeScript configuration
  if (config.language === 'typescript') {
    writeFileSafely(
      fs,
      path.join(config.outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfigTemplate(), null, 2)
    );
  }

  // Jest configuration if tests are enabled
  if (config.features.has('tests')) {
    writeFileSafely(
      fs,
      path.join(config.outputDir, 'jest.config.json'),
      JSON.stringify(jestConfigTemplate(config), null, 2)
    );
  }

  // Docker files if Docker is enabled
  if (config.features.has('docker')) {
    writeFileSafely(
      fs,
      path.join(config.outputDir, 'Dockerfile'),
      dockerfileTemplate()
    );
    writeFileSafely(
      fs,
      path.join(config.outputDir, 'docker-compose.yml'),
      dockerComposeTemplate()
    );
  }
};

const generateBaseFiles = async (collections, config) => {
  const ext = config.language === 'typescript' ? 'ts' : 'js';

  // Generate database configuration
  const dbConfig = `${config.language === 'typescript' ? 'import mongoose from "mongoose";' : 'import mongoose from "mongoose";'}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
};`;

  writeFileSafely(
    fs,
    path.join(config.outputDir, `src/config/db.${ext}`),
    dbConfig
  );

  // Generate error middleware
  const errorMiddleware = `${config.language === 'typescript' ? 'import { Request, Response, NextFunction } from "express";' : ''}

export const errorHandler = (
  err${config.language === 'typescript' ? ': any' : ''},
  req${config.language === 'typescript' ? ': Request' : ''},
  res${config.language === 'typescript' ? ': Response' : ''},
  next${config.language === 'typescript' ? ': NextFunction' : ''}
) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
};`;

  writeFileSafely(
    fs,
    path.join(config.outputDir, `src/middleware/error.${ext}`),
    errorMiddleware
  );

  // Generate auth middleware if auth is enabled
  if (config.features.has('auth')) {
    const authMiddleware = `${config.language === 'typescript' ? 'import { Request, Response, NextFunction } from "express";' : ''}
import jwt from 'jsonwebtoken';
${config.language === 'typescript' ? 'import { Types } from "mongoose";' : ''}

${config.language === 'typescript' ? 'interface JwtPayload { id: string; }' : ''}

export const protect = async (
  req${config.language === 'typescript' ? ': Request & { user?: { _id: Types.ObjectId } }' : ''},
  res${config.language === 'typescript' ? ': Response' : ''},
  next${config.language === 'typescript' ? ': NextFunction' : ''}
) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET${config.language === 'typescript' ? ' as string' : ''}) as JwtPayload;
    req.user = { _id: decoded.id };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};`;

    writeFileSafely(
      fs,
      path.join(config.outputDir, `src/middleware/auth.${ext}`),
      authMiddleware
    );
  }

  // Generate main app file
  const routeImports = collections
    .map(collection => {
      const routeName = collection.collectionName.toLowerCase();
      return `import ${routeName}Routes from './routes/${routeName}.routes';`;
    })
    .join('\n');

  const routeMounts = collections
    .map(collection => {
      const routeName = collection.collectionName.toLowerCase();
      return `app.use('/api/${routeName}s', ${routeName}Routes);`;
    })
    .join('\n');

  const mainApp = `${config.language === 'typescript' ? 'import { Express, Request, Response } from "express";' : ''}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/error';
${config.features.has('swagger') ? 'import swaggerUi from "swagger-ui-express";\nimport swaggerJsDoc from "swagger-jsdoc";' : ''}
${routeImports}

const app${config.language === 'typescript' ? ': Express' : ''} = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
${routeMounts}

${config.features.has('swagger') ? `
// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '${config.projectName} API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [
      {
        url: 'http://localhost:' + (process.env.PORT || 5000),
      },
    ],
  },
  apis: ['./src/routes/*.${ext}'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
` : ''}

// Error handler
app.use(errorHandler);

export default app;`;

  writeFileSafely(
    fs,
    path.join(config.outputDir, `src/app.${ext}`),
    mainApp
  );

  // Generate server file
  const server = `import app from './app';
import { connectDB } from './config/db';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err${config.language === 'typescript' ? ': Error' : ''}) => {
  console.log(\`Error: \${err.message}\`);
  // Close server & exit process
  server.close(() => process.exit(1));
});`;

  writeFileSafely(
    fs,
    path.join(config.outputDir, `src/index.${ext}`),
    server
  );
};
