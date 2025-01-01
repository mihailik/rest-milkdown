// @ts-check

import { keymap as proseMirrorKeymap } from 'prosemirror-keymap';

import { applyUnicodeModifiers } from './apply-unicode-modifiers';

/**
 * @param {() => void} triggerUpdateButtons
 */
export function createKeymapPlugin(triggerUpdateButtons) {

  /** @param {string} mod */
  const createModHandler = (mod) => {

    return modHandler;

    /**
     * @param {import("prosemirror-state").EditorState} editorState
     * @param {((tr: import("prosemirror-state").Transaction) => void) | undefined} dispatch
     * @param {import("prosemirror-view").EditorView | undefined} view
     */
    function modHandler(editorState, dispatch, view) {
      //const editorState = ctx.get(editorStateCtx);
      const apply = applyUnicodeModifiers(editorState, mod);

      if (apply) {
        dispatch?.(apply);
        triggerUpdateButtons();
        return true;
      }

      return false;
    }
  };

  const unicodeFormatKeymap = proseMirrorKeymap({
    'Mod-Alt-b': createModHandler('bold'),
    'Mod-Shift-b': createModHandler('bold'),
    'Mod-Alt-Shift-b': createModHandler('bold'),

    'Mod-Alt-i': createModHandler('italic'),
    'Mod-Shift-i': createModHandler('italic'),
    'Mod-Alt-Shift-i': createModHandler('italic'),

    'Mod-Alt-j': createModHandler('joy'),
    'Mod-Shift-j': createModHandler('joy'),
    'Mod-Alt-Shift-j': createModHandler('joy'),

    'Mod-Alt-t': createModHandler('typewriter'),
    'Mod-Shift-t': createModHandler('typewriter'),
    'Mod-Alt-Shift-t': createModHandler('typewriter'),
  });

  return unicodeFormatKeymap;
}
