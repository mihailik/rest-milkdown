// @ts-check

/**
 * @param {import('.').RenderParams<import('..').ScriptRuntimeStateUnknown>} _
 * @returns {(import('.').RenderedSpan |
 *  import('.').RenderedWidget |
 *  string
 * )[]}
 */
export function renderUnknown({ }) {
  return [{ class: 'low', textContent: 'unknown' }];
}
