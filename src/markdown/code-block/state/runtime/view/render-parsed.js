// @ts-check

import { renderSpansWithClass } from './render-executing';
import { renderFailed } from './render-failed';
import { renderSucceeded } from './render-succeeded';

/**
 * @param {import('.').RenderParams<import('..').ScriptRuntimeStateParsed>} args
 * @returns {(import('.').RenderedSpan |
 *  import('.').RenderedWidget |
 *  string
 * )[]}
 */

export function renderParsed(args) {
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
