// @ts-check

import { renderFailed } from './render-failed';
import { renderSucceeded } from './render-succeeded';

/**
 * @param {import('.').RenderParams<import('..').ScriptRuntimeStateExecuting>} args
 * @returns {(import('.').RenderedSpan |
 *  import('.').RenderedWidget |
 *  string
 * )[]}
 */

export function renderExecuting(args) {
  const { scriptState } = args;
  if (scriptState.stale?.phase === 'failed') {
    const failedPart = renderFailed({ ...args, scriptState: scriptState.stale });
    return [...renderSpansWithClass(failedPart, 'stale stale-executing')];
  } else if (scriptState.stale?.phase === 'succeeded') {
    const succeededPart = renderSucceeded({ ...args, scriptState: scriptState.stale });
    return [...renderSpansWithClass(succeededPart, 'stale stale-executing')];
  }

  return [];
}

/**
 * @param {(import('.').RenderedSpan |
 *  import('.').RenderedWidget |
 *  string
 * )[]} spans
 * @param {string} className
 */
export function renderSpansWithClass(spans, className) {
  return spans.map(span => {
    if (typeof span === 'string') return { class: className, textContent: span };
    else if (span.class) return { ...span, class: span.class + ' ' + className };
    else return span;
  });
}
