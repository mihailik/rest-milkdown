// @ts-check

import { EditorState, Transaction } from '@milkdown/prose/state';
import { getSelectionModifiersForDocument } from './get-selection-modifiers';
import { applyUnicodeModifiers } from './apply-unicode-modifiers';

export const NO_UNICODE_AUTOFORMAT_TRANSACTION = 'NO_UNICODE_AUTO_FORMAT_TRANSACTION';

/**
 * @param {readonly Transaction[]} transactions
 * @param {EditorState} oldState 
 * @param {EditorState} newState 
 */
export function adjustTypingTransaction(transactions, oldState, newState) {
  /** @type {undefined | { oldStart: number, oldEnd: number, newStart: number, newEnd: number }} */
  let single;
  let multiple;
  for (const tr of transactions) {
    if (!tr.docChanged) continue;

    if (tr.getMeta('history$')) return;
    if (tr.getMeta(NO_UNICODE_AUTOFORMAT_TRANSACTION)) return;
    if (tr.getMeta('setLargeResultAreaText')) return;

    if (tr.steps.length !== 1) continue;
    const step = tr.steps[0];
    const stepMap = step.getMap();

    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (multiple) return;
      if (single) {
        single = undefined;
        multiple = true;
      } else {
        single = { oldStart, oldEnd, newStart, newEnd };
      }
    });
    if (multiple) break;

    if (single?.newStart === single?.newEnd) {
      single = undefined;
    }
  }

  if (!single) return null;

  const oldSelMod = getSelectionModifiersForDocument(oldState, { from: single.oldStart, to: single.oldEnd, expandToText: true });

  const oldModifiers = oldSelMod.modifiers;

  const adjustTransaction = applyUnicodeModifiers(
    newState,
    () => {
      return { add: oldModifiers };
    },
    { from: single.newStart, to: single.newEnd }
  );

  if (adjustTransaction) return adjustTransaction;
}
