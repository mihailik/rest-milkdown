// @ts-check

// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import { insertedInTransaction } from '../state/plugin-completion-service';
import { getTypescriptLanguageServiceFromEditorState, resolveDocumentPositionToTypescriptCodeBlock } from './plugin-lang';

const key = new PluginKey('TYPESCRIPT_FORMATTING_SERVICE');
export const typescriptFormattingServicePlugin = new Plugin({
  key,
  appendTransaction: (transactions, oldEditorState, newEditorState) => {
    let inserted;
    let insertedCount = 0;
    for (const tr of transactions) {
      const trInserted = insertedInTransaction(tr);
      if (trInserted) {
        inserted = trInserted;
        insertedCount++;
      }
    }

    if (insertedCount !== 1 || !inserted || inserted.from !== inserted.to || inserted.text.length !== 1) return;

    const insertPos = inserted.from;

    const tsBlock = resolveDocumentPositionToTypescriptCodeBlock(newEditorState, insertPos);
    if (!tsBlock?.lang || !tsBlock?.fileName) return;

    const blockScriptPos = tsBlock.block.script.pos + 1;

    const insertedPosInScript = inserted.from - blockScriptPos + (inserted.text === '\n' ? 0 : 1);

    const formats = tsBlock.lang.languageService.getFormattingEditsAfterKeystroke(
      tsBlock.fileName,
      insertedPosInScript,
      inserted.text,
      {
        indentSize: 2,
        tabSize: 2,
        trimTrailingWhitespace: true,
        convertTabsToSpaces: true,
        indentStyle: tsBlock.lang.ts.IndentStyle.Smart,
        insertSpaceAfterCommaDelimiter: true,
        indentMultiLineObjectLiteralBeginningOnBlankLine: true,
        insertSpaceBeforeAndAfterBinaryOperators: true
      });

    let tr = newEditorState.tr.setMeta('addToHistory', false);
    let adjust = 0;
    let insertPosAdjusted = insertedPosInScript;
    for (const fmt of formats) {
      if (insertedPosInScript > fmt.span.start)
        insertPosAdjusted += fmt.newText.length - fmt.span.length;

      if (fmt.newText) {
        tr = tr.replaceRangeWith(
          blockScriptPos + adjust + fmt.span.start,
          blockScriptPos + adjust + fmt.span.start + fmt.span.length,
          newEditorState.schema.text(fmt.newText));

        console.log(
          'replaceRangeWith:\n',
          tsBlock.block.code.slice(0, fmt.span.start) +
          '|' + JSON.stringify(fmt.newText) + '|' +
          (!fmt.span.length ? '' : '(' + tsBlock.block.code.slice(fmt.span.start, fmt.span.start + fmt.span.length) + ')') +
          tsBlock.block.code.slice(fmt.span.start + fmt.span.length));
      } else {
        tr = tr.deleteRange(
          blockScriptPos + adjust + fmt.span.start,
          blockScriptPos + adjust + fmt.span.start + fmt.span.length);

        console.log(
          'replaceRangeWith:\n',
          tsBlock.block.code.slice(0, fmt.span.start) +
          (!fmt.span.length ? '' : '(' + tsBlock.block.code.slice(fmt.span.start, fmt.span.start + fmt.span.length) + ')') +
          tsBlock.block.code.slice(fmt.span.start + fmt.span.length));
      }

      adjust += fmt.newText.length - fmt.span.length;
    }

    if (inserted.text === '\n') {
      const indent = tsBlock.lang.languageService.getIndentationAtPosition(
        tsBlock.fileName,
        insertedPosInScript,
        {
          tabSize: 2,
          indentStyle: tsBlock.lang.ts.IndentStyle.Smart
        });
      if (indent > 0) {
        console.log('indent', indent, '\n' +
          tsBlock.block.code.slice(0, insertPosAdjusted) + '|' + tsBlock.block.code.slice(insertPosAdjusted) + '|');

        tr = tr.replaceRangeWith(
          blockScriptPos + insertPosAdjusted + 1,
          blockScriptPos + insertPosAdjusted + 1,
          newEditorState.schema.text([...Array(indent + 1)].join(' ')));
      }
    }

    return tr;
  },
  view: (editorView) => {
    return {};
  }
});
