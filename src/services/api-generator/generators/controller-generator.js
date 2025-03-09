import { toPascalCase, toCamelCase } from '../utils.js';

export const generateController = (collection, config) => {
  const modelName = toPascalCase(collection.collectionName);
  const variableName = toCamelCase(collection.collectionName);
  const ext = config.language === 'typescript' ? 'ts' : 'js';

  // TypeScript types
  const tsTypes = config.language === 'typescript'
    ? `import { Request, Response } from 'express';
import { I${modelName} } from '../models/${variableName}.model';`
    : '';

  // Model import
  const modelImport = `import { ${modelName} } from '../models/${variableName}.model';`;

  // Generate CRUD operations
  const operations = `
/**
 * Get all ${variableName}s
 * @route GET /api/${variableName}s
 */
export const getAll${modelName}s = async (${config.language === 'typescript' ? 'req: Request, res: Response' : 'req, res'}) => {
  try {
    const ${variableName}s = await ${modelName}.find();
    res.status(200).json({
      success: true,
      data: ${variableName}s
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get single ${variableName}
 * @route GET /api/${variableName}s/:id
 */
export const get${modelName} = async (${config.language === 'typescript' ? 'req: Request, res: Response' : 'req, res'}) => {
  try {
    const ${variableName} = await ${modelName}.findById(req.params.id);
    
    if (!${variableName}) {
      return res.status(404).json({
        success: false,
        error: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ${variableName}
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Create new ${variableName}
 * @route POST /api/${variableName}s
 */
export const create${modelName} = async (${config.language === 'typescript' ? 'req: Request, res: Response' : 'req, res'}) => {
  try {
    // Handle empty strings for ObjectId references
    const data = { ...req.body };
    Object.keys(data).forEach(key => {
      const field = ${modelName}.schema.path(key);
      if (field && field.instance === 'ObjectID' && data[key] === '') {
        data[key] = null;
      }
    });

    const ${variableName} = await ${modelName}.create(data);
    
    res.status(201).json({
      success: true,
      data: ${variableName}
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate field value entered'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update ${variableName}
 * @route PUT /api/${variableName}s/:id
 */
export const update${modelName} = async (${config.language === 'typescript' ? 'req: Request, res: Response' : 'req, res'}) => {
  try {
    // Handle empty strings for ObjectId references
    const data = { ...req.body };
    Object.keys(data).forEach(key => {
      const field = ${modelName}.schema.path(key);
      if (field && field.instance === 'ObjectID' && data[key] === '') {
        data[key] = null;
      }
    });

    const ${variableName} = await ${modelName}.findByIdAndUpdate(
      req.params.id,
      data,
      {
        new: true,
        runValidators: true
      }
    );

    if (!${variableName}) {
      return res.status(404).json({
        success: false,
        error: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ${variableName}
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate field value entered'
      });
    }

    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Delete ${variableName}
 * @route DELETE /api/${variableName}s/:id
 */
export const delete${modelName} = async (${config.language === 'typescript' ? 'req: Request, res: Response' : 'req, res'}) => {
  try {
    const ${variableName} = await ${modelName}.findByIdAndDelete(req.params.id);

    if (!${variableName}) {
      return res.status(404).json({
        success: false,
        error: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};`;

  return {
    fileName: `${variableName}.controller.${ext}`,
    content: `${tsTypes}
${modelImport}
${operations}
`
  };
};
