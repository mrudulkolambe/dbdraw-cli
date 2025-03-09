import { toPascalCase, toCamelCase } from '../utils.js';

export const generateModel = (collection, config) => {
  const modelName = toPascalCase(collection.collectionName);
  const ext = config.language === 'typescript' ? 'ts' : 'js';
  
  // Handle imports based on language
  const imports = config.language === 'typescript'
    ? `import { Schema, model, Document, Types } from 'mongoose';`
    : `import mongoose from 'mongoose';
const { Schema } = mongoose;`;

  // Generate TypeScript interface if needed
  const tsInterface = config.language === 'typescript'
    ? `\nexport interface I${modelName} extends Document {
${collection.fields
  .filter(field => field.name !== '_id')
  .map(field => {
    let typeStr = getTypeScriptType(field);
    return `  ${field.name}${field.required ? '' : '?'}: ${typeStr};`;
  })
  .join('\n')}
}\n`
    : '';

  // Generate schema
  const schemaFields = collection.fields
    .filter(field => field.name !== '_id')
    .map(field => {
      const options = [];
      
      if (field.type === 'ref') {
        options.push(`type: ${config.language === 'typescript' ? 'Types.ObjectId' : 'Schema.Types.ObjectId'}`);
        if (field.ref) {
          options.push(`ref: '${field.ref}'`);
        }
      } else {
        options.push(`type: ${getMongooseType(field.type)}`);
      }
      
      if (field.required) options.push('required: true');
      if (field.unique) options.push('unique: true');
      if (field.default !== undefined && field.default !== '') {
        options.push(`default: ${JSON.stringify(field.default)}`);
      }
      
      return `  ${field.name}: {
    ${options.join(',\n    ')}${field.list ? ',\n    array: true' : ''}
  }`;
    })
    .join(',\n');

  const schemaDefinition = `const ${modelName}Schema = new Schema({
${schemaFields}
}, {
  timestamps: true
});\n`;

  // Add schema methods and hooks section
  const schemaMethods = `
// Handle empty string to null conversion for ObjectId fields
${modelName}Schema.pre('save', function(next) {
  const doc = this;
  const objectIdFields = Object.keys(${modelName}Schema.paths).filter(
    path => ${modelName}Schema.paths[path].instance === 'ObjectID'
  );

  objectIdFields.forEach(field => {
    if (doc[field] === '') {
      doc[field] = null;
    }
  });

  next();
});\n`;

  // Export the model
  const modelExport = config.language === 'typescript'
    ? `export const ${modelName} = model<I${modelName}>('${modelName}', ${modelName}Schema);`
    : `export const ${modelName} = model('${modelName}', ${modelName}Schema);`;

  return {
    fileName: `${toCamelCase(collection.collectionName)}.model.${ext}`,
    content: `${imports}

${tsInterface}${schemaDefinition}${schemaMethods}${modelExport}
`
  };
};

const getTypeScriptType = (field) => {
  let type = '';
  
  switch (field.type.toLowerCase()) {
    case 'string':
      type = 'string';
      break;
    case 'number':
      type = 'number';
      break;
    case 'boolean':
      type = 'boolean';
      break;
    case 'date':
      type = 'Date';
      break;
    case 'ref':
      type = field.ref ? `Types.ObjectId | ${toPascalCase(field.ref)}` : 'Types.ObjectId';
      break;
    case 'primary':
      type = 'Types.ObjectId';
      break;
    default:
      type = 'any';
  }
  
  return field.list ? `${type}[]` : type;
};

const getMongooseType = (type) => {
  switch (type.toLowerCase()) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'Date';
    case 'primary':
      return 'Schema.Types.ObjectId';
    default:
      return 'String';
  }
};
