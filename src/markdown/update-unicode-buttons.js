// @ts-check

import { defaultValueCtx, editorStateCtx, editorViewCtx, prosePluginsCtx, rootCtx } from '@milkdown/core';

import { getSelectionModifiersForDocument } from './unicode-formatting/get-selection-modifiers';
import { applyUnicodeModifiers } from './unicode-formatting/apply-unicode-modifiers';

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
export function updateUnicodeButtons(ctx) {
  const editorState = ctx.get(editorStateCtx);

  const selMods = getSelectionModifiersForDocument(editorState);
  //console.log('selection modifiers ', selMods);

  const modifiers = selMods.modifiers;

  const buttons = queryDOMForUnicodeModifierButtons();

  const btnPressedClassNameRegexp = /\s*\bpressed\b\s*/g;

  for (const btn of buttons) {
    if (btn.id) {
      var pressed = modifiers && modifiers.indexOf(btn.id) >= 0;

      if (pressed && !(btnPressedClassNameRegexp.test(btn.className || ''))) btn.className = (btn.className || '').trim() + ' pressed';
      else if (btnPressedClassNameRegexp.test(btn.className || '')) btn.className = btn.className.replace(btnPressedClassNameRegexp, ' ');
    }
  }

}

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
export function wireUpButtons(ctx) {
  const buttons = queryDOMForUnicodeModifierButtons();
  for (const btn of buttons) {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();

      const editorState = ctx.get(editorStateCtx);

      const apply = applyUnicodeModifiers(editorState, btn.id);

      if (apply) {
        const editorView = ctx.get(editorViewCtx);
        editorView.dispatch(apply);

        updateUnicodeButtons(ctx);
      }

    });
  }
}

export function queryDOMForUnicodeModifierButtons() {
  const buttonsArray = /** @type {NodeListOf<HTMLButtonElement>} */(
    document.querySelectorAll('#toolbar #unicode_tools button'));
  return Array.from(buttonsArray);
}
