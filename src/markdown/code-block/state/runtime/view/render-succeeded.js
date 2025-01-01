// @ts-check

import { renderValue } from './text';

export const DEFAULT_DESIRABLE_EXPAND_HEIGHT = 100;

/**
 * @param {import('.').RenderParams<import('..').ScriptRuntimeStateSucceeded>} renderParams
 * @returns {(import('.').RenderedContent)[]}
 */
export function renderSucceeded(renderParams) {
  const { scriptState, viewState, invalidate } = renderParams;

  /**
   * @type {(import('.').RenderedContent)[]}
   */
  let output = [];
  output.push({
    widget: () => {
      const span = document.createElement('span');
      span.className = 'success success-time execution-time';
      span.textContent = (scriptState.completed - scriptState.started) / 1000 + 's ';
      return span;
    }
  });

  // if (!viewState.tableViewSelected) {
    if (scriptState.result === undefined) {
      output.push({ class: 'success success-undefined', textContent: 'OK' });
    } else {
      const objArr = [
        renderValue({
          value: scriptState.result,
          path: '',
          indent: '',
          wrap: { availableHeight: DEFAULT_DESIRABLE_EXPAND_HEIGHT },
          invalidate,
          state: viewState
        })].flat();
      output = output.concat(objArr);
    }
  // }

  return output;
}
