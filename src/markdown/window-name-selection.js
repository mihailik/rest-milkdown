// @ts-check

import { Selection, TextSelection } from '@milkdown/prose/state';
import { EditorView } from '@milkdown/prose/view';

/**
 * @param {EditorView} editorView
 * @param {string} markdownText
 */
export function restoreSelectionFromWindowName(editorView, markdownText) {
  const hash = calcHash(markdownText);
  const data = extractDataFromWindowName();

  if (data?.hash !== hash) {
    // remove outdated data
    if (data) {
      window.name = window.name.slice(0, data.index) + window.name.slice(data.index + data.length);
    }
    return setSelectionDefault(editorView);
  }

  if (data && data.selectionStart >= 0 && data.selectionLength >= 0 && data.selectionStart + data.selectionLength <= editorView.state.doc.nodeSize) {
    const newSelectionIsDifferentFromCurrent =
      editorView.state.selection.from !== data.selectionStart &&
      editorView.state.selection.to !== data.selectionStart + data.selectionLength;

    if (newSelectionIsDifferentFromCurrent) {
      const start = Math.min(Math.max(0, data.selectionStart), editorView.state.doc.content.size - 1);
      const end = Math.max(start, Math.min(data.selectionStart + data.selectionLength, editorView.state.doc.content.size));

      const newSelection = new TextSelection(
        editorView.state.doc.resolve(start),
        editorView.state.doc.resolve(end));
      const setSelectionTransaction = editorView.state.tr.setSelection(newSelection);
      editorView.dispatch(setSelectionTransaction);
      return;
    }
  }

  setSelectionDefault(editorView)
}

/**
 * @param {EditorView} editorView
 */
function setSelectionDefault(editorView) {

  const firstBlock = (editorView.state.doc.firstChild || editorView.state.doc);

  const newSelection = new TextSelection(
    editorView.state.doc.resolve(firstBlock.nodeSize - 1),
    editorView.state.doc.resolve(firstBlock.nodeSize - 1));
  
  const setSelectionTransaction = editorView.state.tr.setSelection(newSelection);
  editorView.dispatch(setSelectionTransaction);
}

/**
 * @param {EditorView} editorView
 * @param {string} markdownText
 */
export function storeSelectionToWindowName(editorView, markdownText) {
  const hash = calcHash(markdownText);
  const data = extractDataFromWindowName();

  const updatedData = {
    ...(data?.hash === hash ? data : {}),
    hash,
    selectionStart: editorView.state.selection.from,
    selectionLength: editorView.state.selection.to - editorView.state.selection.from
  };

  const updatedDataStr = '(tty:' + JSON.stringify(updatedData) + ')';

  if (data) {
    window.name = window.name.slice(0, data.index) + updatedDataStr + window.name.slice(data.index + data.length);
  } else {
    window.name += updatedDataStr;
  }
}

function extractDataFromWindowName() {
  const dataMatch = /\(tty:([^)]+)\)/.exec(window.name || '');
  if (!dataMatch) return;

  try {
    const parsed = JSON.parse(dataMatch[1]);
    if (parsed && typeof parsed === 'object')
      return { ...parsed, index: dataMatch.index, length: dataMatch[0].length };
  } catch (error) {
  }
}

/**
 * @param {string} str
 */
function calcHash(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
