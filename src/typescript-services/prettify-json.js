// @ts-check

/**
 * @param {string} json
 * @param {import('.').LanguageServiceAccess} accessLang
 */
export function prettifyJson(json, accessLang) {
  accessLang.update({
    'source-file.json': json
  });

  const ast = /** @type {import('typescript').SourceFile} */(accessLang.languageService.getProgram()?.getSourceFile('source-file.json'));
  if (!ast) return json;

  /** @type {{ from: number, to: number, fill: string }[]} */
  const collapseSpans = [];
  ast.forEachChild(visit);
  collapseSpans.sort((a, b) => a.from - b.from);

  let pos = 0;
  let output = '';
  for (const span of collapseSpans) {
    output += json.slice(pos, span.from) + span.fill;
    pos = span.to;
  }
  output += json.slice(pos);

  return output;

  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    if (accessLang.ts.isObjectLiteralExpression(node)) {
      // no need to collapse already collapsed
      if (ast.getLineEndOfPosition(node.pos) === ast.getLineEndOfPosition(node.end)) return;

      let shouldFoldToSingleLine = true;
      let allPropertiesShort = true;
      for (const property of node.properties) {
        if (ast.getLineEndOfPosition(property.getStart()) !== ast.getLineEndOfPosition(property.end)) {
          shouldFoldToSingleLine = false;
          break;
        }
        if (property.getWidth() > 10) allPropertiesShort = false;
      }

      if (!allPropertiesShort && shouldFoldToSingleLine && node.getText().replace(/\s*\n\s*/g, '').length > 180) shouldFoldToSingleLine = false;

      if (shouldFoldToSingleLine) {
        let lastPropEnd = 0;
        for (const property of node.properties) {
          if (!lastPropEnd) {
            collapseSpans.push({
              from: node.getStart(),
              to: property.getStart(),
              fill: '{ '
            });
          } else {
            collapseSpans.push({
              from: lastPropEnd,
              to: property.getStart(),
              fill: ', '
            });
          }

          lastPropEnd = property.end;
        }
        if (lastPropEnd) {
          collapseSpans.push({
            from: lastPropEnd,
            to: node.end,
            fill: ' }'
          });
        }
      } else {
        node.forEachChild(visit);
      }
    } else if (accessLang.ts.isArrayLiteralExpression(node)) {
      // no need to collapse already collapsed
      if (ast.getLineEndOfPosition(node.pos) === ast.getLineEndOfPosition(node.end)) return;

      let shouldCollapseToSingleLine = true;
      let allPropertiesShort = true;
      for (const property of node.elements) {
        if (ast.getLineEndOfPosition(property.getStart()) !== ast.getLineEndOfPosition(property.end)) {
          shouldCollapseToSingleLine = false;
          break;
        }
        if (property.getWidth() > 10) allPropertiesShort = false;
      }

      if (!allPropertiesShort && shouldCollapseToSingleLine && node.getText().replace(/\s*\n\s*/g, '').length > 180) shouldCollapseToSingleLine = false;

      if (shouldCollapseToSingleLine) {
        let lastPropEnd = 0;
        for (const property of node.elements) {
          if (!lastPropEnd) {
            collapseSpans.push({
              from: node.getStart(),
              to: property.getStart(),
              fill: '['
            });
          } else {
            collapseSpans.push({
              from: lastPropEnd,
              to: property.getStart(),
              fill: ', '
            });
          }

          lastPropEnd = property.end;
        }
        if (lastPropEnd) {
          collapseSpans.push({
            from: lastPropEnd,
            to: node.end,
            fill: ']'
          });
        }
      } else {
        node.forEachChild(visit);
      }
    } else {
      node.forEachChild(visit);
    }
  }
}