import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export function convertJsonToCollectionsFormat(json) {
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
              `type: ${field.list ? '[' : ''}${language === 'typescript' ? 'Schema.Types.ObjectId' : 'mongoose.Schema.Types.ObjectId'}${field.list ? ']' : ''}`,
              `ref: "${field.ref}"`,
              field.required ? `required: true` : ""
            );
          } else {
            fieldOptions.push(`type: ${field.list ? '[' : ''}${mapFieldTypeToMongoose(field.type)}${field.list ? ']' : ''}`);
            if (field.required) fieldOptions.push(`required: true`);
            if (field.unique) fieldOptions.push(`unique: true`);
            if (field.default !== undefined)
              fieldOptions.push(`default: ${JSON.stringify(field.default)}`);
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

export const saveSchemas = async (collections, savePath, selectedModels, language = "javascript") => {
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
