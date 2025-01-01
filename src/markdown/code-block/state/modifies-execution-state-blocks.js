// @ts-check

import { Transaction } from '@milkdown/prose/state';
import { ReplaceAroundStep, ReplaceStep } from '@milkdown/prose/transform';

import { findOverlappingCodeBlocks, getTransactionCodeBlocks } from '../state-block-regions/find-code-blocks';

/**
 * @param {Transaction} tr
 */
export function modifiesExecutionStateBlocks(tr) {
  if (!tr.docChanged) return false;
  if (tr.getMeta('history$')) return false;

  const codeBlockNodes = getTransactionCodeBlocks(tr);

  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) {
      continue;
    }

    const overlapping = findOverlappingCodeBlocks(step, codeBlockNodes);

    if (!overlapping) {
      continue;
    }

    if (overlapping.only) {
      // TODO: if result.isSignificant, then expand the step to the whole of result
      // otherwise, exclude the result ONLY from the step

      // temporary implementation, fault whole transaction if results affected
      if (overlapping.only.executionState?.overlap && overlapping.only.executionState.overlap) {
        return true;
      }
    } else {
      // TODO: for the [leading AND trailing], if result.isSignificant, then expand the step to the whole of result
      // otherwise -
      //  * for [leading] exclude both the code and the result from the step
      //  * for [trailing] exclude the result ONLY from the step

      // TODO: for the overlapping.whollyContained, leave them alone

      // temporary implementation, fault whole transaction if results affected
      if (overlapping.leading?.executionState?.overlap ||
        overlapping.trailing?.result?.overlap ||
        false //overlapping.whollyContained?.length
      ) {
        return true;
      }
    }
  }

  return false;
}