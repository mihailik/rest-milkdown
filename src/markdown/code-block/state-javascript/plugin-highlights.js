// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { getTypeScriptCodeBlocks, onTypeScriptIternalStateChanged } from './plugin-lang';
import { addCodeHighlightProvider } from '../state/plugin-highlight-service';

const key = new PluginKey('TYPESCRIPT_HIGHLIGHT');
export const typescriptHighlightPlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      var invalidateOnTSChange;
      addCodeHighlightProvider(
        editorState,
        {
          codeHighlights: ({ codeBlockRegions, editorState, invalidate }) => {
            invalidateOnTSChange = invalidate;
            const { tsBlocks, lang } = getTypeScriptCodeBlocks(editorState);
            const decoArray = !lang ? [] : getHighlightSpansForCodeBlocks(lang, tsBlocks);
            return decoArray;
          },
          selectionHighlights: ({ codeBlockRegions, editorState, selectionRelative }) => {
            const { tsBlocks, lang } = getTypeScriptCodeBlocks(editorState);
            const decoArray = !lang ? [] : getSelectionHighlightSpansForCodeBlocks(
              lang,
              tsBlocks,
              selectionRelative);
            return decoArray;
          }
        });
      onTypeScriptIternalStateChanged(
        editorState,
        () => {
          invalidateOnTSChange?.();
        });
    },
    apply: (tr, pluginState, oldState, newState) => undefined
  },
});

/**
 * @param {import("../../../typescript-services").LanguageServiceAccess} lang
 * @param {ReturnType<getTypeScriptCodeBlocks>['tsBlocks']} tsBlocks
 */
function getHighlightSpansForCodeBlocks(lang, tsBlocks) {
  /** @type {({from: number, to: number, class: string }[] | undefined)[]} */
  const highlightsOfBlocks = [];

  for (let iBlock = 0; iBlock < tsBlocks.length; iBlock++) {
    const tsBlock = tsBlocks[iBlock];
    if (!tsBlock?.fileName) continue;

    const blockHighlights = getHighlightSpansForCode(lang, tsBlock.block.code, tsBlock.fileName);
    if (blockHighlights.length) highlightsOfBlocks[iBlock] = blockHighlights;
  }

  return highlightsOfBlocks;
}

/**
 * @param {import("../../../typescript-services").LanguageServiceAccess} lang
 * @param {ReturnType<getTypeScriptCodeBlocks>['tsBlocks']} tsBlocks
 * @param {{ iBlock: number, offset: number }} selection
 */
function getSelectionHighlightSpansForCodeBlocks(lang, tsBlocks, selection) {
  /** @type {({from: number, to: number, class: string }[] | undefined)[]} */
  const highlightsOfBlocks = [];

  const cursorTsBlock = tsBlocks[selection.iBlock];
  if (cursorTsBlock) {
    // const refs = lang.languageService.getReferencesAtPosition(cursorTsBlock.fileName, selection.offset)
    // if (refs?.length) {
    //   for (const ref of refs) {
    //     const iRefTsBlock = tsBlocks.findIndex(b => b.fileName === ref.fileName);
    //     if (iRefTsBlock >= 0) {
    //       const tsHighlights = highlightsOfBlocks[iRefTsBlock] || (highlightsOfBlocks[iRefTsBlock] = []);
    //       tsHighlights.push({
    //         from: ref.textSpan.start,
    //         to: ref.textSpan.start + ref.textSpan.length,
    //         class: 'hi-ref'
    //       });
    //     }
    //   }
    // }

    let braces = lang.languageService.getBraceMatchingAtPosition(cursorTsBlock.fileName, selection.offset);
    if (!braces?.length && selection.offset) braces = lang.languageService.getBraceMatchingAtPosition(cursorTsBlock.fileName, selection.offset - 1)
    if (braces?.length) {
      const tsHighlights = highlightsOfBlocks[selection.iBlock] || (highlightsOfBlocks[selection.iBlock] = []);
      for (const b of braces) {
        tsHighlights.push({
          from: b.start,
          to: b.start + b.length,
          class: 'hi-bracematch'
        });
      }
    }
  }

  return highlightsOfBlocks;
}

/**
 * @param {import("../../../typescript-services").LanguageServiceAccess} lang
 * @param {string} code
 * @param {string} codeFileName
 */
export function getHighlightSpansForCode(lang, code, codeFileName) {
  const { languageService, ts } = lang;

  let program;

  const blockHighlights = [];
  const syntaxHighlights = languageService.getSyntacticClassifications(
    codeFileName,
    ts.createTextSpan(0, code.length));

  /** @type {import('typescript').Node[] | undefined} */
  let nodes;

  for (const hi of syntaxHighlights) {
    if (hi.classificationType === 'string') {
      // split off quotes, check if used as property
      if (!nodes) {
        nodes = [];

        if (!program) program = lang.languageService.getProgram();
        if (program) {
          const source = program.getSourceFile(codeFileName);
          if (source) {
            /** @param {import('typescript').Node} node */
            const visitor = (node) => {
              for (let pos = node.pos; pos < node.end; pos++) {
                  /** @type {NonNullable<typeof nodes>}*/(nodes)[pos] = node;
              }
              node.forEachChild(visitor);
            };
            source.forEachChild(visitor);
          }
        }
      }

      const node = nodes[hi.textSpan.start];
      if (node && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
        const spanText = code.slice(hi.textSpan.start, hi.textSpan.start + hi.textSpan.length);
        const openingQuote = spanText.charAt(0);
        const closingQuote = spanText.charAt(spanText.length - 1);
        if (openingQuote === closingQuote && (openingQuote === '"' || openingQuote === "'")) {
          blockHighlights.push({
            from: hi.textSpan.start,
            to: hi.textSpan.start + 1,
            class: 'hi-string-property-quote'
          });
          blockHighlights.push({
            from: hi.textSpan.start + 1,
            to: hi.textSpan.start + 1 + hi.textSpan.length - 2,
            class: 'hi-string hi-property'
          });
          blockHighlights.push({
            from: hi.textSpan.start + hi.textSpan.length - 1,
            to: hi.textSpan.start + hi.textSpan.length,
            class: 'hi-string-property-quote'
          });
        } else {
          blockHighlights.push(createHighlightSpanForClassification(
            hi.textSpan,
            hi.classificationType + ' property'
          ));
        }
        continue;
      }
    }

    blockHighlights.push(createHighlightSpanForClassification(hi.textSpan, hi.classificationType));
  }

  // const semanticHighlights = languageService.getSemanticClassifications(
  //   codeBlockFileName,
  //   ts.createTextSpan(0, code.length));

  // for (const hi of semanticHighlights) {
  //   decorations.push(createDecorationForClassification(script.pos, hi));
  // }

  const syntaxErrors = languageService.getSyntacticDiagnostics(codeFileName);

  for (const err of syntaxErrors) {
    let className = 'hi-err hi-err-' + ts.DiagnosticCategory[err.category];

    const deco = {
      from: err.start,
      to: err.start + err.length,
      class: className
    };
    blockHighlights.push(deco);
  }

  const semanticErrors = languageService.getSemanticDiagnostics(codeFileName);
  for (const err of semanticErrors) {

    if (typeof err.start !== 'number' || typeof err.length !== 'number') continue;

    let className =
      'hi-err hi-err-semantic hi-err-semantic-' + ts.DiagnosticCategory[err.category];

    const deco = {
      from: err.start,
      to: err.start + err.length + 1,
      class: className
    };
    blockHighlights.push(deco);
  }

  return blockHighlights;
}

/**
 * @param {import('typescript').TextSpan} textSpan
 * @param {string} classificationType
 */
function createHighlightSpanForClassification(textSpan, classificationType) {
  const className = getSyntaxClassName(classificationType);
  const deco = {
    from: textSpan.start,
    to: textSpan.start + textSpan.length,
    class: className
  };
  return deco;
}

/**
 * @type {Record<string,string> | undefined}
 */
var cache;

/**
 * @param {string} classificationType
 */
export function getSyntaxClassName(classificationType) {
  const cachedResult = cache?.[classificationType];

  if (cachedResult) return cachedResult;

  if (!cache) {
    const result = classificationType.split(' ').map(s => 'hi-' + s).join(' ');
    cache = { [classificationType]: result };
    return result;
  } else {
    const result = classificationType.split(' ').map(s => 'hi-' + s).join(' ');
    cache[classificationType] = result;
    return result;
  }
}
