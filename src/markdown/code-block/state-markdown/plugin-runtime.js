// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';

import { cssBlockFilename, htmlCodeToJavaScriptCreateElement } from '../state-html/plugin-runtime';
import { registerJSRuntimePreprocessor } from '../state-javascript/plugin-runtime';

const key = new PluginKey('MARKDOWN_RUNTIME');
export const markdownRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      registerJSRuntimePreprocessor(
        editorState,
        ({ codeBlockRegions, editorState }) => {
          const allCSS = codeBlockRegions.map((block, iBlock) => {
            const cssFileName = cssBlockFilename(iBlock, block.language, block.langSpecified);
            if (cssFileName) return '/** ' + cssFileName + ' **/\n' + block.code;
          }).filter(Boolean).join('\n\n');

          return codeBlockRegions.map((block, iBlock) => {
            const markdownFileName = markdownBlockFilename(iBlock, block.language, block.langSpecified);
            const markdown = block.code.trim();
            if (markdownFileName) {
              return {
                fileName: markdownFileName,
                text: htmlCodeToJavaScriptCreateElement({
                  html: markdownCodeToHTML(markdown),
                  fileName: markdownFileName,
                  allCSS
                })
              };
            }
          });
        });
    },
    apply: (tr, pluginState, oldState, newState) => pluginState
  },
});

/**
 * @param {string} markdownText
 */
export function markdownCodeToHTML(markdownText) {
  const processor = remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeFormat)
    .use(rehypeStringify);
  const parsed = processor.processSync(markdownText);
  return String(parsed);
}

/**
 * @param {number} iBlock
 * @param {string | null | undefined} language
 * @param {string | null | undefined} langSpecified
 */
function markdownBlockFilename(iBlock, language, langSpecified) {
  if (language === 'Markdown') return 'Markdown-' + iBlock + '.md.js';
}
