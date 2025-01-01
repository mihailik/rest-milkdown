// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { findCodeBlocks } from './find-code-blocks';

class CodeBlockRegionsPlugin {
  /**
   * @param {import('@milkdown/prose/state').EditorStateConfig} config
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  constructor(config, editorState) {
    this.config = config;
    this.editorState = editorState;
    /** @type {import('@milkdown/prose/view').EditorView | undefined} */
    this.editorView = undefined;

    this.codeBlocks = findCodeBlocks(editorState.doc);
    this.codeOnlyIteration = 0;
    this.codeOrPositionsIteration = 0;
  }

  /**
   * @param {import('@milkdown/prose/state').Transaction} tr
   * @param {import('@milkdown/prose/state').EditorState} oldEditorState
   * @param {import('@milkdown/prose/state').EditorState} newEditorState
   */
  apply = (tr, oldEditorState, newEditorState) => {
    if (!tr.docChanged) return;

    const codeBlocks = findCodeBlocks(newEditorState.doc);
    const change = codeMatch(codeBlocks, this.codeBlocks);
    if (change) this.codeOrPositionsIteration++;
    if (change > 1) this.codeOnlyIteration++;

    this.codeBlocks = codeBlocks;
  }
}

const key = new PluginKey('CODE_BLOCK_REGIONS');
export const codeBlockRegionsPlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => new CodeBlockRegionsPlugin(config, editorState),
    apply: (tr, pluginState, oldState, newState) => {
      pluginState.apply(tr, oldState, newState);
      return pluginState;
    }
  },
  view: (editorView) => {
    const pluginState = key.getState(editorView.state);
    pluginState.editorView = editorView;

    return {};
  }
});

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState 
 */
export function getCodeBlockRegionsOfEditorState(editorState) {
  const pluginState = codeBlockRegionsPlugin.getState(editorState);
  if (!pluginState) return;

  const codeBlockRegionsResult = {
    codeBlocks: pluginState.codeBlocks,
    codeOnlyIteration: pluginState.codeOnlyIteration,
    codeOrPositionsIteration: pluginState.codeOrPositionsIteration,
    /** @type {{ iBlock: number, offset: number } | undefined} */
    selectionRelative: undefined
  };

  for (let iBlock = 0; iBlock < pluginState.codeBlocks.length; iBlock++) {
    const block = pluginState.codeBlocks[iBlock];
    if (block.script) {
      if (editorState.selection.head >= block.script.pos + 1 &&
        editorState.selection.head <= block.script.pos + block.script.node.nodeSize - 1) {
        codeBlockRegionsResult.selectionRelative = {
          iBlock,
          offset: editorState.selection.head - block.script.pos - 1
        };
        break;
      }
    }
  }

  return codeBlockRegionsResult;
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {number} pos
 */
export function resolveDocumentPositionToCodeBlock(editorState, pos) {
  const pluginState = codeBlockRegionsPlugin.getState(editorState);
  if (!pluginState) return;

  for (let iBlock = 0; iBlock < pluginState.codeBlocks.length; iBlock++) {
    const block = pluginState.codeBlocks[iBlock];
    const minCodeBlockPos = block.script.pos + 1;
    const maxCodeBlockPos = block.script.pos + block.script.node.nodeSize - 1;
    if (pos >= minCodeBlockPos && pos <= maxCodeBlockPos) {
      return {
        ...block,
        codePos: pos - minCodeBlockPos,
        index: iBlock
      };
    }
  }
}

/**
 * @param {import('@milkdown/prose/view').EditorView} editorView
 */
export function getCodeBlockRegionsOfEditorView(editorView) {
  return getCodeBlockRegionsOfEditorState(editorView.state);
}

/** @typedef {2} ChangedCode */
/** @typedef {1} ChangedPositions */
/** @typedef {0} ChangedNothing */

/**
 * @param {import('./find-code-blocks').CodeBlockNodeset[]} codeBlocks1
 * @param {import('./find-code-blocks').CodeBlockNodeset[]} codeBlocks2
 * @returns {ChangedCode | ChangedPositions | ChangedNothing}
 */
function codeMatch(codeBlocks1, codeBlocks2) {
  if (codeBlocks1.length !== codeBlocks2.length) return 2;

  let changedPositions = false;
  for (let i = 0; i < codeBlocks1.length; i++) {
    if (codeBlocks1[i].code !== codeBlocks2[i].code ||
      codeBlocks1[i].language !== codeBlocks2[i].language) {
      return 2;
    } if (codeBlocks1[i].script.pos !== codeBlocks2[i].script.pos) {
      changedPositions = true;
    }
  }

  return changedPositions ? 1 : 0;
}
