// @ts-check

import { Plugin, PluginKey, Selection, TextSelection, Transaction } from '@milkdown/prose/state';
import { ReplaceStep } from '@milkdown/prose/transform';


export function createResultEditingTransactionResult() {
  const pluginKey = new PluginKey('FILTER_RESULT_EDITING');
  const pluginFilterEditing = new Plugin({
    key: pluginKey,
    filterTransaction: (tr, state) => {
      // let the code result changes flow normally
      if (tr.getMeta('setLargeResultAreaText')) return true;

      const codeBlockNodes = findCodeBlocks(state.doc);

      let anyStepsModified = false;
      /** @type {typeof tr.steps} */
      const filteredSteps = [];

      for (const step of tr.steps) {
        if (!(step instanceof ReplaceStep)) {
          filteredSteps.push(step);
          continue;
        }

        const overlapping = findOverlappingCodeBlocks(step, codeBlockNodes);
        console.log('overlapping', overlapping, tr);

        if (!overlapping) {
          filteredSteps.push(step);
          continue;
        }

        if (overlapping.only) {
          // TODO: if result.isSignificant, then expand the step to the whole of result
          // otherwise, exclude the result ONLY from the step

          // temporary implementation, fault whole transaction if results affected
          if (overlapping.only.result?.overlap) {
            return false;
          }
        } else {
          // TODO: for the [leading AND trailing], if result.isSignificant, then expand the step to the whole of result
          // otherwise -
          //  * for [leading] exclude both the code and the result from the step
          //  * for [trailing] exclude the result ONLY from the step

          // TODO: for the overlapping.whollyContained, leave them alone

          // temporary implementation, fault whole transaction if results affected
          if (overlapping.leading?.result?.overlap ||
            overlapping.trailing?.result?.overlap ||
            overlapping.whollyContained?.length
          ) {
            return false;
          }
        }
      }

      return true;
    }
  });

  return pluginFilterEditing;
}

/**
 * @param {ReplaceStep} step
 * @param {ReturnType<typeof findCodeBlocks>} codeBlockNodes
 */
function findOverlappingCodeBlocks(step, codeBlockNodes) {
  let leading;
  let whollyContained = [];
  let trailing;

  for (let i = 0; i < codeBlockNodes.length; i++) {
    const entry = codeBlockNodes[i];
    if (entry.code.pos > step.to) break; // entry is after the change area

    const entryEnd = entry.result ?
      entry.result.pos + entry.result.node.nodeSize :
      entry.code.pos + entry.code.node.nodeSize;
    
    if (step.from > entryEnd) continue; // entry is before the change area

    if (step.from > entry.code.pos) {
      // code block is leading

      if (step.to < entryEnd) {
        // code block is leading and trailing
        return {
          only: {
            code: {
              ...entry.code.node,
              overlap: spanOverlap(step, entry.code.pos, entry.code.node.nodeSize)
            },
            result: !entry.result ? undefined : {
              ...entry.result,
              overlap: entry.result && spanOverlap(step, entry.result.pos, entry.result.node.nodeSize)
            }
          },
          leading: undefined,
          trailing: undefined,
          whollyContained: undefined
        };
      } else {
        // code block is only leading
        leading = {
          code: {
            ...entry.code.node,
            overlap: spanOverlap(step, entry.code.pos, entry.code.node.nodeSize)
          },
          result: !entry.result ? undefined : {
            ...entry.result,
            overlap: spanOverlap(step, entry.result.pos, entry.result.node.nodeSize)
          }
        };
      }
    } else {
      // overlap starts from the beginning of the code block
      if (step.to < entryEnd) {
        // code block is wholly contained
        whollyContained.push(entry);
      } else {
        // code block is trailing
        trailing = {
          code: {
            ...entry.code.node,
            overlap: spanOverlap(step, entry.code.pos, entry.code.node.nodeSize)
          },
          result: !entry.result ? undefined : {
            ...entry.result,
            overlap: spanOverlap(step, entry.result.pos, entry.result.node.nodeSize)
          }
        };
      }
    }

  }

  if (leading || !trailing || whollyContained.length) {
    return {
      only: undefined,
      leading,
      trailing,
      whollyContained
    };
  }

}

/**
 * @param {import("prosemirror-model").Node} doc
 */
function findCodeBlocks(doc) {
  /**
   * @type {{
   *  code: { node: import ("prosemirror-model").Node, pos: number },
   *  result?:  { node: import ("prosemirror-model").Node, pos: number }
   * }[]}
   */
  let codeBlocks = [];
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (node.type.name === 'code_block') {
      codeBlocks.push({ code: { node, pos } });
    } else {
      if (node.isBlock) {
        let lastCodeBlock = codeBlocks[codeBlocks.length - 1];
        if (node.type.name === 'code_block_execution_state' &&
          lastCodeBlock &&
          lastCodeBlock.code.pos + lastCodeBlock.code.node.nodeSize === pos) {
          lastCodeBlock.result = { node, pos };
        }
      }
    }
  });

  return codeBlocks;
}

/**
 * @param {import("prosemirror-model").Node} doc
 * @param {(node: import('prosemirror-model').Node, pos: number) => boolean} filter
 */
function getNodesWithPositions(doc, filter) {
  /**
   * @type {{
   *  node: import ("prosemirror-model").Node,
   *  pos: number
   * }[]}
   */
  let resultNodes = [];
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (filter(node, pos)) {
      resultNodes.push({ node, pos });
    }
  });
  return resultNodes;
}

/**
 * @param {{ from: number, to: number }} span
 * @param {number} pos
 * @param {number} size
 */
function spanOverlap(span, pos, size) {
  const commonPos = Math.max(span.from, pos);
  const commonEnd = Math.min(span.to, pos + size);
  if (commonEnd > commonPos ||
    (commonEnd === span.to && span.from >= pos && span.to <= pos + size)) {
    const commonSize = commonEnd - commonPos;
    return {
      pos: commonPos,
      size: commonSize,
      isSignificant: commonSize > size * 0.66 || commonSize >= 3
    };
  }
}
