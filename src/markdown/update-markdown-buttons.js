// @ts-check

import { defaultValueCtx, editorStateCtx, editorViewCtx, prosePluginsCtx, rootCtx } from '@milkdown/core';
import { commandsCtx, Editor, editorCtx } from '@milkdown/kit/core';
import { commonmark, toggleEmphasisCommand, toggleStrongCommand } from '@milkdown/kit/preset/commonmark';

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
export function updateMarkdownButtons(ctx) {
  const view = ctx.get(editorViewCtx);
  let hasBold = view.state.doc.rangeHasMark(
    view.state.selection.from,
    view.state.selection.to,
    view.state.schema.marks.strong);
  let hasItalic = view.state.doc.rangeHasMark(
    view.state.selection.from,
    view.state.selection.to,
    view.state.schema.marks.emphasis);

  view.state.doc.nodesBetween(
    view.state.selection.from,
    view.state.selection.to,
    (node, pos) => {
      if (node.marks) {
        for (let m of node.marks) {
          if (m.type.name === 'strong') hasBold = true;
          if (m.type.name === 'emphasis') hasItalic = true;
        }
      }
    });

  const buttons = queryDOMForMarkdownButtons();
  for (const btn of buttons) {
    if (btn.id === 'bold') {
      if (hasBold) btn.classList.add('pressed');
      else btn.classList.remove('pressed');
    }
    if (btn.id === 'italic') {
      if (hasItalic) btn.classList.add('pressed');
      else btn.classList.remove('pressed');
    }
  }
}

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
export function wireUpMarkdownButtons(ctx) {
  const buttons = queryDOMForMarkdownButtons();
  const styles = {
    italic: toggleEmphasisCommand,
    bold: toggleStrongCommand
  };

  for (const btn of buttons) {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const cmd = styles[btn.id];
      if (!cmd) {
        const editorState = ctx.get(editorStateCtx);
        console.log('editorState ', editorState);
        console.log('doc.content ', editorState.doc.content);
        // alert('Style[' + btn.id + '] not wired in Markdown in this version.');
        return;
      }

      // const editorState = ctx.get(editorStateCtx);
      // const editorView = ctx.get(editorViewCtx);

      const editor = ctx.get(editorCtx);

      editor.action((ctx) => {
        const commandManager = ctx.get(commandsCtx);
        commandManager.call(cmd.key);
      });

    });
  }
}

export function queryDOMForMarkdownButtons() {
  const buttonsArray = /** @type {NodeListOf<HTMLButtonElement>} */(
    document.querySelectorAll('#toolbar #markdown_tools button'));
  return Array.from(buttonsArray);
}
