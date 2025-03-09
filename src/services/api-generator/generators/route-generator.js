import { toPascalCase, toCamelCase } from '../utils.js';

export const generateRoute = (collection, config) => {
  const modelName = toPascalCase(collection.collectionName);
  const variableName = toCamelCase(collection.collectionName);
  const ext = config.language === 'typescript' ? 'ts' : 'js';

  // TypeScript types
  const tsImport = config.language === 'typescript'
    ? `import { Router } from 'express';\n`
    : `import { Router } from 'express';\n`;

  // Controller imports
  const controllerImports = `import {
  getAll${modelName}s,
  get${modelName},
  create${modelName},
  update${modelName},
  delete${modelName}
} from '../controllers/${variableName}.controller';`;

  // Auth middleware import if needed
  const authImport = config.features.has('auth')
    ? `import { protect } from '../middleware/auth';\n`
    : '';

  // Router setup
  const routerSetup = `const router = Router();`;

  // Route definitions with optional auth middleware
  const routes = `
/**
 * @route /api/${variableName}s
 */
router.route('/')
  .get(${config.features.has('auth') ? 'protect, ' : ''}getAll${modelName}s)
  .post(${config.features.has('auth') ? 'protect, ' : ''}create${modelName});

/**
 * @route /api/${variableName}s/:id
 */
router.route('/:id')
  .get(${config.features.has('auth') ? 'protect, ' : ''}get${modelName})
  .put(${config.features.has('auth') ? 'protect, ' : ''}update${modelName})
  .delete(${config.features.has('auth') ? 'protect, ' : ''}delete${modelName});`;

  // Export
  const exportStatement = `export default router;`;

  return {
    fileName: `${variableName}.routes.${ext}`,
    content: `${tsImport}${authImport}${controllerImports}

${routerSetup}

${routes}

${exportStatement}
`
  };
};
