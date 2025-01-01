// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { modifiesExecutionStateBlocks } from '../modifies-execution-state-blocks';
import { ExecutiveManager } from './executive-manager';

/**
 * @typedef {{
 *  executionStarted?: number,
 *  executionEnded?: number,
 *  succeeded?: boolean,
 *  error?: any,
 *  result?: any
 * }} CodeBlockState
 */

/**
 * @typedef {{
 *  current: number,
 *  executionStates: CodeBlockState[], 
 * }} DocumentCodeState
 */

export const setLargeResultAreaTextMeta = 'setLargeResultAreaText';

const pluginKey = new PluginKey('CODEBLOCK_RUNTIME');

/** @type {import('@milkdown/prose/state').Plugin<ExecutiveManager>} */
export const codeBlockRuntimePlugin = new Plugin({
  key: pluginKey,
  filterTransaction: (tr, state) => {
    // let the code result changes flow normally
    if (tr.getMeta(setLargeResultAreaTextMeta)) return true;

    return !modifiesExecutionStateBlocks(tr);
  },
  state: {
    init: (config, editorState) => new ExecutiveManager(config, editorState),
    apply: (tr, pluginState, oldEditorState, newEditorState) => {
      pluginState.apply(tr, oldEditorState, newEditorState);
      return pluginState;
    }
  },
  appendTransaction: (transactions, oldEditorState, newEditorState) => {
    const pluginState = codeBlockRuntimePlugin.getState(newEditorState);
    if (pluginState)
      return pluginState.appendTransaction(transactions, oldEditorState, newEditorState);
  },
  props: {
    decorations: editorState => {
      /** @type {ExecutiveManager | undefined} */
      const pluginState = codeBlockRuntimePlugin.getState(editorState);
      const decorationSet = pluginState?.getDecorationSet();
      return decorationSet;
    }
  },
  view: editorView => {
    const pluginState = codeBlockRuntimePlugin.getState(editorView.state);
    pluginState?.initEditorView(editorView);
    return {};
  }
});

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {import('.').ExecutionRuntime} runtime
 */
export function registerRuntime(editorState, runtime) {
  const pluginState = codeBlockRuntimePlugin.getState(editorState);
  pluginState?.registerRuntime(runtime);
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @returns {import('.').DocumentRuntimeState['globalVariables'] | undefined}
 */
export function getGlobalVariablesList(editorState) {
  const pluginState = codeBlockRuntimePlugin.getState(editorState);
  return pluginState?.documentState.globalVariables;
}
