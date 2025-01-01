// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { addCodeHighlightProvider } from '../state/plugin-highlight-service';
import { parseHttpText } from './parse-http-text';

const key = new PluginKey('HTTP_HIGHLIGHT');
export const httpHighlightPlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      addCodeHighlightProvider(
        editorState,
        {
          codeHighlights: ({ codeBlockRegions, editorState, invalidate }) => {
            return getHttpHighlightsForCodeBlocks(codeBlockRegions);
          }
        });
    },
    apply: (tr, pluginState, oldState, newState) => undefined
  },
});

/**
 * @param {import('../state-block-regions/find-code-blocks').CodeBlockNodeset[]} codeBlockRegions
 */
function getHttpHighlightsForCodeBlocks(codeBlockRegions) {
  /**
   * @type {(import('../state/plugin-highlight-service').CodeBlockHighlightSpan[] | undefined)[]}
   */
  const highlightsOfBlocks = [];

  for (let iBlock = 0; iBlock < codeBlockRegions.length; iBlock++) {
    const block = codeBlockRegions[iBlock];
    if (block.language !== 'HTTP') continue;

    const parsed = parseHttpText(block.code);
    if (parsed) {
      /** @type {typeof highlightsOfBlocks[0]} */
      const highlights = [];

      if (parsed.firstLine.verbLength)
        highlights.push({
          from: parsed.firstLine.verbPos,
          to: parsed.firstLine.verbPos + parsed.firstLine.verbLength,
          class: 'http-verb'
        });

      if (parsed.firstLine.urlLength)
        highlights.push({
          from: parsed.firstLine.urlPos,
          to: parsed.firstLine.urlPos + parsed.firstLine.urlLength,
          class: 'http-url'
        });

      if (parsed.headers) {
        for (const header of parsed.headers) {
          if (!header) continue;
          if (header.nameLength)
            highlights.push({
              from: header.namePos,
              to: header.namePos + header.nameLength,
              class: 'http-header-name'
            });

          if (header.valueLength)
            highlights.push({
              from: header.valuePos,
              to: header.valuePos + header.valueLength,
              class: 'http-header-value'
            });

          if (header.errors) {
            for (const error of header.errors) {
              highlights.push({
                from: error.pos,
                to: error.pos + error.length,
                class: 'http-header-error'
              });
            }
          }
        }
      }

      if (typeof parsed.bodyPos === 'number' && parsed.bodyLength) {
        highlights.push({
          from: parsed.bodyPos,
          to: parsed.bodyPos + parsed.bodyLength,
          class: 'http-body'
        });
      }

      if (highlights.length) highlightsOfBlocks[iBlock] = highlights;
    }
  }

  return highlightsOfBlocks;
}
