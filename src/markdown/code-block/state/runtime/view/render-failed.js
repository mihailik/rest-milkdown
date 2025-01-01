// @ts-check

import { renderError } from './text/render-error';

import './render-failed.css';

/**
 * @param {import('.').RenderParams<import('..').ScriptRuntimeStateFailed>} _
 * @returns {(import('.').RenderedSpan |
 *  import('.').RenderedWidget |
 *  string
 * )[]}
 */

export function renderFailed({ scriptState, viewState, invalidate }) {
  /** @type {(import('.').RenderedContent)[]} */
  let output = [];
  output.push({
    widget: () => {
      const span = document.createElement('span');
      span.className = 'fail fail-time execution-time';
      span.textContent = (scriptState.completed - scriptState.started) / 1000 + 's';
      return span;
    }
  });

  const errArray = renderError({
    value: scriptState.error,
    path: '',
    indent: '',
    wrap: { availableHeight: 10 },
    invalidate,
    state: viewState
  })
  output = output.concat(errArray);

  return output;
}
