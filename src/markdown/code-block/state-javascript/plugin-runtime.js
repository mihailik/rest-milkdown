// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { registerRuntime } from '../state/runtime/plugin-runtime-service';
import { execIsolation } from '../../../iframe-worker/exec-isolation';
import { getTypeScriptCodeBlocks, onTypeScriptIternalStateChanged } from './plugin-lang';
import { inertLanguageService } from '../../../typescript-services/inert-language-service';

/**
 * @typedef {(args: Parameters<import('../state/runtime').ExecutionRuntime['parse']>[0] & { languageAccess: import('../../../typescript-services').LanguageServiceAccess | undefined }) =>
 *  ({ fileName: string, text: string } | undefined | null)[]
 * } JSRuntimePreprocessor
 */

const defaultFrom = 'esm.sh';
const knownFromAttributes = {
  'unpkg': 'https://unpkg.com/',
  'skypack': 'https://cdn.skypack.dev/',
  'esm.run': 'https://esm.run/',
  'esm.sh': 'https://esm.sh/',
  'jsdelivr': 'https://cdn.jsdelivr.net/npm/'
};
const fromAliases = {
  npm: defaultFrom,
  'esmrun': 'esm.run'
};

class JSRuntime {

  /** @type {JSRuntimePreprocessor[]} */
  preprocessors = [];

  /**
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  constructor(editorState) {
    this.editorState = editorState;
    this.onLog = (...args) => { };

    /** @type {ReturnType<typeof execIsolation> | undefined} */
    this.isolation = undefined;

    /** Will be assigned by the execution service */
    this.onRequestRerun = () => { };
  }

  /**
   * @type {import('../state/runtime').ExecutionRuntime['parse']}
   */
  parse({ codeBlockRegions, editorState }) {
    this.codeBlockRegions = codeBlockRegions;
    this.editorState = editorState;

    const prevParsed = this.parsedCodeBlockInfo;
    this.parsedCodeBlockInfo = undefined;

    this.ensureParsedCodeBlockInfo(prevParsed);

    return codeBlockRegions.map((reg, i) => {
      const parsed = this.parsedCodeBlockInfo?.[i];
      if (parsed) return {
        variables: parsed.variables,
        unchanged: parsed.unchanged,
        syntaxErrors: parsed.syntaxErrors
      };
    });
  }

  /**
   * @type {import('../state/runtime').ExecutionRuntime['runCodeBlock']}
   */
  runCodeBlock(iBlock, globals, logger) {
    if (!this.isolation)
      this.isolation = execIsolation();

    this.ensureParsedCodeBlockInfo();

    const rewriteBlock = this.parsedCodeBlockInfo?.[iBlock];
    if (!rewriteBlock) return;

    const globalsMap = Object.fromEntries([...globals].map((val, i) => ['$' + i, val]));

    return this.isolation.execScriptIsolated(
      rewriteBlock.rewritten,
      globalsMap,
      logger);
  }

  /**
   * @param {typeof this.parsedCodeBlockInfo} [prevParsedCodeBlockInfo]
   */
  ensureParsedCodeBlockInfo(prevParsedCodeBlockInfo) {
    if (this.parsedCodeBlockInfo) return;

    const tsData = getTypeScriptCodeBlocks(this.editorState);
    const { languageService, ts } = tsData.lang || {};
    if (!languageService) {
      if (this.awaitingForLanguageService) return;
      this.awaitingForLanguageService = true;
      const unsubscribe = onTypeScriptIternalStateChanged(
        this.editorState,
        () => {
          this.awaitingForLanguageService = false;
          this.onRequestRerun();
          unsubscribe?.();
        });
    }

    let preprocessedBlocks = [];
    if (ts && this.preprocessors?.length) {
      let preprocessedScripts;
      for (const preprocessor of this.preprocessors) {
        const preprocessedCodeBlocks = preprocessor({
          codeBlockRegions: this.codeBlockRegions || [],
          editorState: this.editorState,
          languageAccess: tsData.lang
        });
        if (preprocessedCodeBlocks) {
          for (let iBlock = 0; iBlock < (this.codeBlockRegions?.length || 0); iBlock++) {
            const preprocessedBlock = preprocessedCodeBlocks[iBlock];
            if (!preprocessedBlock) continue;

            preprocessedBlocks[iBlock] = preprocessedBlock;

            if (!preprocessedScripts) preprocessedScripts = { [preprocessedBlock.fileName]: preprocessedBlock.text };
            else preprocessedScripts[preprocessedBlock.fileName] = preprocessedBlock.text;
          }
        }
      }

      if (!this.preprocessorTS) this.preprocessorTS = inertLanguageService(ts);
      this.preprocessorTS.update({
        scripts: preprocessedScripts,
        resetScripts: true
      });
    }

    const prog = languageService?.getProgram();
    const preprocessedProg = this.preprocessorTS?.languageService?.getProgram();

    /**
     * @type {{ code: string, unchanged: boolean, syntaxErrors: boolean, variables: string[], rewritten: string }[] | undefined}
     */
    this.parsedCodeBlockInfo = [];

    /** @type {{ name: string, type }[]} */
    let globalVariables = [];

    for (let iBlock = 0; iBlock < (this.codeBlockRegions?.length || 0); iBlock++) {
      if (!prog || !languageService || !ts) continue;

      const derivedFileName = preprocessedBlocks[iBlock] ?
        preprocessedBlocks[iBlock].fileName :
        tsData.tsBlocks[iBlock]?.fileName;

      const derivedLanguageService = preprocessedBlocks[iBlock] ?
        this.preprocessorTS?.languageService : languageService;
      
      const derivedProg = preprocessedBlocks[iBlock] ?
        preprocessedProg :
        tsData.tsBlocks[iBlock] && prog;

      const checker = derivedProg?.getTypeChecker();

      const ast = derivedProg?.getSourceFile(derivedFileName);

      if (!ast) continue;

      let globalVariablesIndex = globalVariables.length;

      const syntaxErrors = derivedLanguageService?.getSyntacticDiagnostics(derivedFileName);

      const rewrites = [];

      for (let iStatement = 0; iStatement < ast.statements.length; iStatement++) {
        const st = ast.statements[iStatement];

        const isLastStatement = iStatement === ast.statements.length - 1;

        // pull import source for rewrite (unpkg)
        if (ts.isImportDeclaration(st)) {
          if (ts.isStringLiteralLike(st.moduleSpecifier)) {
            const importSource = deriveImportSource(
              st.moduleSpecifier.text,
              st.attributes?.elements.map(withAttr =>
                withAttr.name.text !== 'from' ? undefined :
                  !ts.isStringLiteralLike(withAttr.value) ? undefined :
                    withAttr.value.text
              ).filter(Boolean)[0]);

            const isImportWithoutNames = !st.importClause?.namedBindings && !st.importClause?.name;
            if (isImportWithoutNames) {
              rewrites.push({
                from: st.pos,
                to: st.end,
                text:
                  (isLastStatement ? 'return ' : 'await ') +
                  `import(${JSON.stringify(importSource)});`
              });
              continue;
            }

            const hasDefaultImport = !!st.importClause?.name;
            const hasNamedImports = st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings);
            const hasStarImport = st.importClause?.namedBindings && ts.isNamespaceImport(st.importClause.namedBindings);

            rewrites.push({
              from: st.pos,
              to: st.end,
              text:
                (isLastStatement ? 'return ' : '') +
                (
                  !hasDefaultImport && !hasNamedImports ? '' :
                    '[{' +
                    (!hasDefaultImport ? '' : 'default: ' + st.importClause.name.escapedText) +
                    (!hasDefaultImport || !hasNamedImports ? '' : ', ') +
                    (!hasNamedImports ? '' :
                      st.importClause.namedBindings.elements.map(e =>
                        !e.propertyName ? e.name.escapedText :
                          e.propertyName.text + ' as ' + e.name.escapedText).join(', ')
                    ) +
                    '}] = '
                ) +

                (
                  !hasStarImport ? '' :
                    '[' + st.importClause.namedBindings.name.escapedText + '] = '
                ) +

                ` [await import(${JSON.stringify(importSource)})];`
            });
          }
        } else if (ts.isVariableStatement(st)) {
          if (st.declarationList.declarations.length) {
            rewrites.push({
              from: st.pos,
              to: st.declarationList.declarations[0].pos,
              text: (isLastStatement ? ';return ' : '')
            });
            for (const decl of st.declarationList.declarations) {
              if (!decl.initializer) {
                rewrites.push({
                  from: decl.end,
                  to: decl.end,
                  text: '=this.' + decl.name.getText()
                });
              }

              const type = checker?.getTypeAtLocation(decl);

              globalVariables.push({
                name: decl.name.getText(),
                type
              });
            }
          }
        } else if (ts.isFunctionDeclaration(st)) {
          if (st.name) {
            rewrites.push(
              {
                from: st.pos,
                to: st.pos,
                text:
                  (isLastStatement ? ';return ' : '') +
                  'this.' + st.name.escapedText + ' = '
              },
              {
                from: st.end,
                to: st.end,
                text: ';'
              });
            const type = checker?.getTypeAtLocation(st);
            globalVariables.push({
              name: st.name.text,
              type
            });
          }
        } else if (ts.isExpressionStatement(st)) {
          if (isLastStatement) {
            rewrites.push({
              from: st.expression.pos,
              to: st.expression.pos,
              text: ';return ('
            });

            rewrites.push({
              from: st.expression.end,
              to: st.expression.end,
              text: ')'
            });
          }
        }
      }

      const code =
        preprocessedBlocks[iBlock] ? preprocessedBlocks[iBlock].text :
          tsData.tsBlocks[iBlock]?.block.code;

      let rewritten = '';
      let lastEnd = 0;
      for (const change of rewrites) {
        rewritten += code.slice(lastEnd, change.from) + change.text;
        lastEnd = change.to;
      }
      rewritten += code.slice(lastEnd);

      rewritten = '(async (console) => {' + rewritten + '\n})(console)';

      const unchanged =
        code === prevParsedCodeBlockInfo?.[iBlock]?.code &&
        rewritten === prevParsedCodeBlockInfo?.[iBlock]?.rewritten;
      
      const localVariables = globalVariables.slice(globalVariablesIndex).map(v => v.name);
      globalVariablesIndex = globalVariables.length;

      this.parsedCodeBlockInfo[iBlock] = {
        code,
        unchanged,
        syntaxErrors: !!syntaxErrors?.length,
        variables: localVariables,
        rewritten
      };
    }
  }

}

const key = new PluginKey('JAVASCRIPT_RUNTIME');
export const javascriptRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      const jsRuntime = new JSRuntime(editorState);
      registerRuntime(
        editorState,
        jsRuntime);
      return jsRuntime;
    },
    apply: (tr, pluginState, oldState, newState) => pluginState
  },
});

/**
 * @param {string} packageReference
 * @param {string} [withFrom]
 */
export function deriveImportSource(packageReference, withFrom) {
  if (packageReference.startsWith('http:') || packageReference.startsWith('https:'))
    return packageReference;
  if (withFrom) {
    const mapToSource =
      knownFromAttributes[withFrom.toLowerCase()] ||
      knownFromAttributes[fromAliases[withFrom.toLowerCase()]];

    if (mapToSource) return mapToSource + packageReference;
  }

  const prefixMatch = /^([a-z\.\-]+):/i.exec(packageReference);
  if (prefixMatch) {
    const mapToSource =
      knownFromAttributes[prefixMatch[1].toLowerCase()] ||
      knownFromAttributes[fromAliases[prefixMatch[1].toLowerCase()]];

    if (mapToSource) return mapToSource + packageReference.slice(prefixMatch[1].length + 1);
  }

  return knownFromAttributes[defaultFrom] + packageReference;
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {JSRuntimePreprocessor} preprocessor
 */
export function registerJSRuntimePreprocessor(editorState, preprocessor) {
  const pluginState = javascriptRuntimePlugin.getState(editorState);
  pluginState?.preprocessors.push(preprocessor);
}
