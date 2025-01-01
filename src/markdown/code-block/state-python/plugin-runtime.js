// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { registerJSRuntimePreprocessor } from '../state-javascript/plugin-runtime';

const key = new PluginKey('PYTHON_RUNTIME');
export const pythonRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      registerJSRuntimePreprocessor(
        editorState,
        ({ codeBlockRegions, editorState }) => {
          return codeBlockRegions.map((block, iBlock) => {
            const fileName = pythonBlockFilename(iBlock, block.language, block.langSpecified);
            if (fileName) return {
              fileName,
              text:
                'import {jsPython} from "jspython-interpreter"; ' +
                '(window.__jspy || (window.__jspy=jsPython())).evaluate(' +
                JSON.stringify(block.code) + ', ' +
                '{' + [...Array(iBlock)].map((_, i) => '$' + i).join(', ') + '}' +
                ');'
            };
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
function pythonBlockFilename(iBlock, language, langSpecified) {
  if (language === 'Python') return 'python-' + iBlock + '.py.js';
}
