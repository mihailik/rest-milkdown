// @ts-check

import { InputRule } from '@milkdown/prose/inputrules';
import { TextSelection } from '@milkdown/prose/state';
import { $inputRule } from '@milkdown/utils';

import { codeBlockBackTickLanguage, codeBlockExecutionState, codeBlockScript, customCodeBlockSchema } from './schema';

export const backtickAutoconvertInputRule = $inputRule(ctx => codeblockTypeInputRule(ctx));

/**
 * Build an input rule that changes the type of a textblock when the
 * matched text is typed into it. You'll usually want to start your
 * regexp with `^` to that it is only matched at the start of a
 * textblock. The optional `getAttrs` parameter can be used to compute
 * the new node's attributes, and works the same as in the
 * `wrappingInputRule` function.
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
function codeblockTypeInputRule(ctx) {
  return new InputRule(
    /^```(?<language>[a-z0-9\.\-\/\\]*)?[\s\n]$/i,
    (state, match, start, end) => {
      let $start = state.doc.resolve(start);
      let attrs = { language: match.groups?.language ?? '' };
      if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), customCodeBlockSchema.type(ctx)))
        return null;

      const codeBlockNode = customCodeBlockSchema.type(ctx).create(
        attrs,
        [
          codeBlockBackTickLanguage.type(ctx).create({}, attrs.language ? state.schema.text(attrs.language) : undefined),
          codeBlockScript.type(ctx).create(),
          codeBlockExecutionState.type(ctx).create(),
        ]
      );

      const insertTransaction = state.tr
        .replaceRangeWith(start, end, codeBlockNode);

      const withSelection = insertTransaction
        .setSelection(TextSelection.create(insertTransaction.doc, end));

      return withSelection;
    });
}