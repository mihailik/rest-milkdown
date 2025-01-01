// @ts-check

export { ScriptRuntimeView } from './script-runtime-view';

/**
 * @typedef {{
 *  class: string,
 *  textContent: string,
 *  widget?: undefined
 * }} RenderedSpan
 */

/**
 * @typedef {{
 *  widget: Parameters<typeof import('@milkdown/prose/view').Decoration.widget>[1],
 *  spec?: Parameters<typeof import('@milkdown/prose/view').Decoration.widget>[2],
 *  class?: undefined,
 *  textContent?: undefined
 * }} RenderedWidget
 */

/** @typedef {RenderedSpan | RenderedWidget | string} RenderedContent */

/**
 * @template {import('..').ScriptRuntimeState} [TScriptRuntimeState = import('..').ScriptRuntimeState]
 * @typedef {{
 *  scriptState: TScriptRuntimeState,
 *  viewState: Record<string, any>,
 *  invalidate(): void
 * }} RenderParams<TScriptRuntimeState>
 */