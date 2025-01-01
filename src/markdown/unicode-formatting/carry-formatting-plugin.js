// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import { adjustTypingTransaction } from './adjust-typing-transaction';


/**
 * @param {() => void} triggerUpdateButtons
 */
export function createCarryFormattingPlugin(triggerUpdateButtons) {
  const pluginKey = new PluginKey('UNICODE_CONVERSIONS');
  const pluginCarryUnicodeConversions = new Plugin({
    key: pluginKey,
    appendTransaction: (transactions, oldState, newState) => {
      triggerUpdateButtons();
      return adjustTypingTransaction(transactions, oldState, newState);
    },
    state: {
      init: (editorStateConfig, editorInstance) => {
        console.log('UNICODE_CONVERSIONS init', { editorStateConfig, editorInstance });
      },
      apply: (tr, value, oldState, newState) => {
      },
    }
  });
  return pluginCarryUnicodeConversions;
}
