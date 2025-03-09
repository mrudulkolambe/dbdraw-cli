export const packageJsonTemplate = (config) => ({
  name: config.projectName,
  version: '1.0.0',
  description: 'Generated API using DrawDB CLI',
  main: config.language === 'typescript' ? 'dist/index.js' : 'src/index.js',
  scripts: {
    start: config.language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
    dev: config.language === 'typescript' 
      ? 'ts-node-dev --respawn --transpile-only src/index.ts'
      : 'nodemon src/index.js',
    build: config.language === 'typescript' ? 'tsc' : 'echo "No build step needed"',
    test: config.features.has('tests') ? 'jest' : 'echo "No tests specified"',
  },
  dependencies: {
    'express': '^4.18.2',
    'mongoose': '^7.5.0',
    'cors': '^2.8.5',
    'dotenv': '^16.3.1',
    'helmet': '^7.0.0',
    ...(config.features.has('auth') ? {
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
    } : {}),
    ...(config.features.has('swagger') ? {
      'swagger-ui-express': '^5.0.0',
      'swagger-jsdoc': '^6.2.8',
    } : {}),
  },
  devDependencies: {
    ...(config.language === 'typescript' ? {
      'typescript': '^5.2.2',
      'ts-node-dev': '^2.0.0',
      '@types/node': '^20.5.9',
      '@types/express': '^4.17.17',
      '@types/cors': '^2.8.14',
      ...(config.features.has('auth') ? {
        '@types/jsonwebtoken': '^9.0.2',
        '@types/bcryptjs': '^2.4.3',
      } : {}),
      ...(config.features.has('swagger') ? {
        '@types/swagger-ui-express': '^4.1.3',
        '@types/swagger-jsdoc': '^6.0.1',
      } : {}),
    } : {
      'nodemon': '^3.0.1',
    }),
    ...(config.features.has('tests') ? {
      'jest': '^29.6.4',
      'supertest': '^6.3.3',
      ...(config.language === 'typescript' ? {
        '@types/jest': '^29.5.4',
        '@types/supertest': '^2.0.12',
        'ts-jest': '^29.1.1',
      } : {}),
    } : {}),
  },
  type: 'module',
});

export const envTemplate = () => `# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/your_database

# JWT Configuration (if using authentication)
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=30d
`;

export const dockerfileTemplate = () => `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
`;

export const dockerComposeTemplate = () => `version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/your_database
    depends_on:
      - mongo
    volumes:
      - .:/app
      - /app/node_modules

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
`;

export const gitignoreTemplate = () => `# Dependencies
node_modules/

# Build
dist/

# Environment
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
`;

export const readmeTemplate = (config) => `# ${config.projectName}

API generated using DrawDB CLI

## Features

- Express.js REST API
- MongoDB with Mongoose
${config.features.has('auth') ? '- JWT Authentication\n' : ''}${config.features.has('swagger') ? '- Swagger Documentation\n' : ''}${config.features.has('docker') ? '- Docker Setup\n' : ''}${config.features.has('tests') ? '- Unit Tests\n' : ''}

## Getting Started

### Prerequisites

- Node.js ${config.language === 'typescript' ? '(v14+ recommended)' : '(v12+ recommended)'}
- MongoDB
${config.features.has('docker') ? '- Docker (optional)\n' : ''}

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Create a \`.env\` file in the root directory (see \`.env.example\`)
4. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

${config.features.has('docker') ? `### Using Docker

\`\`\`bash
docker-compose up
\`\`\`
` : ''}
## API Documentation

${config.features.has('swagger') ? 'Visit `/api-docs` for the Swagger documentation.' : 'API endpoints documentation coming soon.'}

## Scripts

- \`npm start\`: Start the production server
- \`npm run dev\`: Start the development server
${config.features.has('tests') ? '- `npm test`: Run tests\n' : ''}${config.language === 'typescript' ? '- `npm run build`: Build the TypeScript code\n' : ''}

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Mongoose models
├── routes/         # API routes
├── utils/          # Utility functions
${config.features.has('tests') ? '├── __tests__/      # Test files\n' : ''}└── index.${config.language === 'typescript' ? 'ts' : 'js'}     # App entry point
\`\`\`
`;

export const tsConfigTemplate = () => `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}`;

export const jestConfigTemplate = (config) => `/** @type {import('jest').Config} */
const config = {
  ${config.language === 'typescript' ? `
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }]
  },` : `
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },`}
  testMatch: [
    '**/tests/**/*.${config.language === 'typescript' ? 'ts' : 'js'}',
    '**/?(*.)+(spec|test).${config.language === 'typescript' ? 'ts' : 'js'}'
  ],
  verbose: true
};

export default config;`;
