/**
 * @typedef {{
 *  statement: import('typescript').ImportDeclaration;
 *  variableNames: string[];
 *  moduleName: string;
 *  moduleNameStartPos: number;
 *  moduleNameEndPos: number;
 * }} ImportLocation
 */

/**
 * @typedef {{
 *  statement: import('typescript').DeclarationStatement
 * }} VariableDeclaration
 */

/**
 * @typedef {{
 *  imports: ImportLocation[];
 *  variables: VariableDeclaration[];
 * }} BlockAstTransformLocations
 */

const astTransforms = [];

for (let iBlock = 0; iBlock < docState.blocks.length; iBlock++) {
  /**
   * @type {BlockAstTransformLocations}
   */
  const transform = {
    imports: [],
    variables: []
  };
  astTransforms.push(transform);

  const block = docState.blocks[iBlock];
  if (!block.ast) continue;

  for (const st of block.ast.statements) {
    if (ts.isImportDeclaration(st)) {
      if (st.importClause && ts.isStringLiteral(st.moduleSpecifier)) {
        /** @type {string[]} */
        const names = [];
        if (st.importClause.name)
          names.push(st.importClause.name.text);
        if (st.importClause.namedBindings) {
          if (st.importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
            names.push(st.importClause.namedBindings.name.text);
          } else if (st.importClause.namedBindings.elements?.length) {
            for (const el of st.importClause.namedBindings.elements) {
              names.push(el.name.text);
            }
          }
        }

        if (names.length) {
          transform.imports.push({
            statement: st,
            variableNames: names,
            moduleName: st.moduleSpecifier.text,
            moduleNameStartPos: st.moduleSpecifier.pos,
            moduleNameEndPos: st.moduleSpecifier.end
          })
        }
      }
    }

    if (ts.isDeclarationStatement(st)) {
      // need to strip const/let/var and convert into: globalThis.XYZ = ...
      transform.variables.push({
        statement: st
      });
    } else if (ts.isFunctionDeclaration(st)) {
      // need an assignment lifted to the top of the module: globalThis.FUNC1 = FUNC1
    }
  }
}