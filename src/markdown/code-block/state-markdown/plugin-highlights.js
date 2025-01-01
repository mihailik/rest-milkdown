// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';

import { addCodeHighlightProvider } from '../state/plugin-highlight-service';

const key = new PluginKey('MARKDOWN_HIGHLIGHT');
export const markdownHighlightPlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      addCodeHighlightProvider(
        editorState,
        {
          codeHighlights: ({ codeBlockRegions, editorState, invalidate }) => {
            return getMarkdownHighlightsForCodeBlocks(codeBlockRegions);
          }
        });
    },
    apply: (tr, pluginState, oldState, newState) => undefined
  },
});

/**
 * @param {import('../state-block-regions/find-code-blocks').CodeBlockNodeset[]} codeBlockRegions
 */
function getMarkdownHighlightsForCodeBlocks(codeBlockRegions) {
  /**
   * @type {(import('../state/plugin-highlight-service').CodeBlockHighlightSpan[] | undefined)[]}
   */
  const highlightsOfBlocks = [];

  for (let iBlock = 0; iBlock < codeBlockRegions.length; iBlock++) {
    const block = codeBlockRegions[iBlock];
    if (block.language !== 'Markdown') continue;

    const parsed = parseMarkdownText(block.code);
    if (parsed) {
      /** @type {typeof highlightsOfBlocks[0]} */
      const highlights = [];

      const nestType = [];

      /** @param {typeof parsed | typeof parsed.children[0]} node */
      const visitNode = (node) => {
        let pushed = false;
        if (node.type && node.type !== 'root' && node.type !== 'text') {
          let className = node.type;
          switch (node.type) {
            case 'heading':
              className += '-' + node.depth;
              break;
          }

          nestType.push(className);
          pushed = true;
        }

        if (/** @type {typeof parsed} */(node).children?.length) {
          for (const child of /** @type {typeof parsed} */(node).children) {
            visitNode(child);
          }
        }

        if (node.type && typeof node.position?.start.offset === 'number' && typeof node.position.end.offset === 'number') {
          const from = node.position.start.offset;
          const to = node.position.end.offset;

          if (to > from && nestType.length) {
            highlights.push({
              from,
              to,
              class: nestType.length === 1 ? 'hi-' + nestType[0] : 'hi-' + nestType.join('-') + ' hi-' + nestType[nestType.length - 1],
            });
          }
        }

        if (pushed) {
          nestType.pop();
        }
      };
      visitNode(parsed);

      if (highlights.length) highlightsOfBlocks[iBlock] = highlights;
    }
  }

  return highlightsOfBlocks;
}

var parser;

/**
 * @param {string} markdownText
 */
export function parseMarkdownText(markdownText) {
  const processor = remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true });

  const parsed = processor.parse(markdownText);
  return parsed;
}
