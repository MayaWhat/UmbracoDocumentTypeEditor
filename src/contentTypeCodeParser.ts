import * as esprima from 'esprima';
import * as estree from 'estree';
import * as parserModels from './models/parser';

type Scope = { [key: string]: any };

export class ParserError extends Error {
    constructor(error: string, public range?: [number, number] ) {
        super(error);
    }
}

export function parseContentTypeCode(code: string) {
    const module = esprima.parseModule(code);

    const scope: Scope = {};
    scope['DocumentType'] = parserModels.DocumentType;
    scope['Tab'] = parserModels.Tab;
    scope['Group'] = parserModels.Group;
    scope['Property'] = parserModels.Property;

    const exportDeclarations = module.body.filter(x => x.type == 'ExportDefaultDeclaration');

    if (exportDeclarations.length != 1) {
        throw new Error("Expected one default export statement with a DocumentType");
    }

    const contentType = parseStatement(exportDeclarations[0], scope);
    if (!(contentType instanceof parserModels.DocumentType)) {
        throw new Error("Export is not a DocumentType");
    }

    return contentType;
}

function parseStatement(statement: estree.Directive | estree.Statement | estree.ModuleDeclaration, scope: Scope) {
    switch (statement.type) {
        case 'ExportDefaultDeclaration':
            return parseExportDefaultDeclaration(statement, scope);
        default:
            throw new ParserError(`Unsupported statement ${statement.type}`, statement.range);
    }
}

function parseExportDefaultDeclaration(declaration: estree.ExportDefaultDeclaration, scope: Scope) {
    if (!declaration.declaration) {
        return null;
    }

    if (declaration.declaration.type != 'NewExpression') {
        throw new ParserError(`Unsupported declaration ${declaration.declaration.type}`, declaration.declaration.range);
    }

    return parseNewExpression(declaration.declaration, scope);
}

function parseExpression(expression: estree.Expression | estree.Pattern, scope: Scope): any {
    switch(expression.type) {
        case 'Literal':
            return expression.value;
        case 'NewExpression':
            return parseNewExpression(expression, scope);
        case 'ObjectExpression':
            return parseObjectExpression(expression, scope);
        case 'ArrayExpression':
            return parseArrayExpression(expression, scope);
        default:
            throw new ParserError(`Unsupported expression ${expression.type}`, expression.range);
    }
}

function parseNewExpression(expression: estree.NewExpression, scope: Scope) {
    if (expression.callee.type !== 'Identifier') {
        throw new ParserError(`Unsupported callee ${expression.callee.type}`, expression.callee.range);
    }

    const callee = scope[expression.callee.name];
    if (!callee) {
        throw new ParserError(`Unknown identifier ${expression.callee.name}`, expression.callee.range);
    }

    if (typeof callee !== 'function') {
        throw new ParserError(`${expression.callee.name} is not a class`, expression.callee.range);
    }
    
    const args: any[] = expression.arguments.map(x => {
        if (x.type === 'SpreadElement') {
            throw new ParserError(`Spread operator is not supported`, x.range);
        }

        return parseExpression(x, scope);
    });

    return new callee(...args);
}

function parseObjectExpression(expression: estree.ObjectExpression, scope: Scope) {
    return expression.properties.map(x => {
        if (x.type !== 'Property') {
            throw new ParserError(`Unsupported type ${x.type}`, x.range);
        }

        if (x.key.type !== 'Identifier') {
            throw new ParserError(`Unsupported key ${x.key.type}`, x.key.range);
        }

        return {
            key: x.key.name,
            value: parseExpression(x.value, scope)
        };
    }).reduce((previousValue, currentValue) => ({
        ...previousValue,
        [currentValue.key]: currentValue.value
    }), {});
}

function parseArrayExpression(expression: estree.ArrayExpression, scope: Scope) {
    return expression.elements.map(x => {
        if (!x) {
            return null;
        }

        if (x.type === 'SpreadElement') {
            throw new ParserError(`Spread operator is not supported`, x.range);
        }

        return parseExpression(x, scope);
    })
}