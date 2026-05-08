/**
 * Recursively removes 'line' and 'column' properties from an AST in-place
 * so that it can be deeply compared against expected ASTs in tests.
 */
export function stripLocationData(ast: any): any {
  if (Array.isArray(ast)) {
    ast.forEach(stripLocationData);
  } else if (ast !== null && typeof ast === 'object') {
    delete ast.line;
    delete ast.column;
    for (const key in ast) {
      if (ast[key] !== null && typeof ast[key] === 'object') {
        stripLocationData(ast[key]);
      }
    }
  }
  return ast;
}