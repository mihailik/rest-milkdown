// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { registerJSRuntimePreprocessor } from '../state-javascript/plugin-runtime';

const key = new PluginKey('TS_RUNTIME');

/** @type {import('typescript').TranspileOptions} */
var transpileOptions;

export const tsRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      registerJSRuntimePreprocessor(
        editorState,
        ({ codeBlockRegions, editorState, languageAccess }) => {
          if (!languageAccess) return [];

          if (!transpileOptions) {
            transpileOptions = {
              compilerOptions: {
                ...languageAccess.languageHost.getCompilationSettings(),
                target: languageAccess.ts.ScriptTarget.ESNext,
                module: languageAccess.ts.ModuleKind.ESNext,
                jsx: languageAccess.ts.JsxEmit.React,
              }
            };
          }

          return codeBlockRegions.map((block, iBlock) => {
            const fileName = tsBlockFilename(iBlock, block.language, block.langSpecified);
            if (fileName) {
              const transpiled = languageAccess.ts.transpileModule(block.code, transpileOptions);
              return {
              fileName,
              text: transpiled.outputText
              };
            }
          })
        });
    },
    apply: (tr, pluginState, oldState, newState) => pluginState
  },
});

/**
 * @param {number} iBlock
 * @param {string | null | undefined} language
 * @param {string | null | undefined} langSpecified
 */
function tsBlockFilename(iBlock, language, langSpecified) {
  if (language === 'TypeScript') return langSpecified + '-' +iBlock + '.js';
}
