import * as escodegen from 'escodegen';
import * as umbracoModels from './models/umbraco';
import * as parserModels from './models/parser';
import { mapUmbracoDocumentTypeToParser } from './contentTypeModelMapper';

export function generateContentTypeCodeFile(contentType: umbracoModels.DocumentTypeDisplay, allContentTypes: umbracoModels.ContentTypeBasic[]) {
  const mapped = mapUmbracoDocumentTypeToParser(contentType, allContentTypes);

  const ast = {
    type: 'Program',
    body: [
      makeNode('ExportDefaultDeclaration', {
        declaration: generateCode(mapped)
      })
    ],
    'sourceType': 'script'
  };

  return escodegen.generate(ast);
}

export function generateCode<T>(model: T): any {
  if (model == null) {
    return null;
  }

  switch (typeof model) {
    case 'object':
      if (model.constructor.name === 'Array') {
        return arrayExpression(
          (model as any[]).map(x => generateCode(x))
        );
      }

      if (model.constructor.name === 'Object') {
        return objectExpression(Object.keys(model)
          .filter(x => model[x as keyof T] !== undefined)
          .map(x =>
            property(x, generateCode(model[x as keyof T]))
          )
        );
      }

      // Force it to the base class because the only classes we're using are based on it
      const modelClass = model as any as parserModels.Base<any>;

      return newExpression(
        (modelClass.constructor as any).className,
        generateCode(modelClass.props)
      );
    case 'string':
    case 'boolean':
    case 'number':
      return literal(model);
  }
}

function makeNode<T>(type: string, params?: T) {
  return {
    type,
    ...params
  };
}

function identifier(name: string) {
  return makeNode('Identifier', {
    name
  });
}

function objectExpression(properties: any[]) {
  return makeNode('ObjectExpression', {
    properties
  });
}

function arrayExpression(elements: any[]) {
  return makeNode('ArrayExpression', {
    elements
  })
}

function newExpression(className: string, ...args: any[]) {
  return makeNode('NewExpression', {
    callee: identifier(className),
    arguments: args.filter(x => x !== undefined)
  });
}

function property(propertyName: string, value: any) {
  return makeNode('Property', {
    kind: 'init',
    key: identifier(propertyName),
    computed: false,
    value,
    method: false,
    shorthand: false
  });
}

function literal(x: boolean | number | string) {
  return makeNode('Literal', {
    value: x,
    raw: typeof x === 'string' ? `"${x}"` : `${x}`
  });
}