// @ts-check

import { prosePluginsCtx } from '@milkdown/core';

import { backtickAutoconvertInputRule } from './backtick-autoconvert-input-rule';
import { codeBlockBackTickLanguage, codeBlockExecutionState, codeBlockScript, customCodeBlockSchema } from './schema';
import { codeBlockRuntimePlugin } from './state';
import { codeBlockRegionsPlugin } from './state-block-regions';
import { httpHighlightPlugin } from './state-http/plugin-highlights';
import { httpRuntimePlugin } from './state-http/plugin-runtime';
import { typescriptFormattingServicePlugin } from './state-javascript/plugin-auto-formatting';
import { typescriptCompletionsPlugin } from './state-javascript/plugin-completions';
import { typescriptHighlightPlugin } from './state-javascript/plugin-highlights';
import { typescriptLanguagePlugin } from './state-javascript/plugin-lang';
import { javascriptRuntimePlugin } from './state-javascript/plugin-runtime';
import { typescriptTooltipsPlugin } from './state-javascript/plugin-tooltips';
import { sqlRuntimePlugin } from './state-sql/plugin-runtime';
import { completionServicePlugin } from './state/plugin-completion-service';
import { codeHighlightPlugin } from './state/plugin-highlight-service';
import { tooltipServicePlugin } from './state/plugin-tooltip-service';

import './code-block.css';
import './syntax-highlight.css';
import { pythonRuntimePlugin } from './state-python/plugin-runtime';
import { tsRuntimePlugin } from './state-javascript/plugin-runtime-ts';

export const codeBlockPlugins = [
  // TODO: check with Milkdown why this is needed
  milkdownPluginFromSchema(customCodeBlockSchema),
  milkdownPluginFromSchema(codeBlockBackTickLanguage),
  milkdownPluginFromSchema(codeBlockScript),
  milkdownPluginFromSchema(codeBlockExecutionState),
  backtickAutoconvertInputRule,
  /**
 * @param {import("@milkdown/ctx").Ctx} ctx
   */
  (ctx) => {
    // this plugin business is messed up somehow in the integration with Milkdown
    // @ts-ignore
    ctx.update(prosePluginsCtx, (prev) => [
      ...prev,
      ...proseMirrorPlugins
    ]);

    return () => {
    };
  }
];

export const proseMirrorPlugins = [
  codeBlockRegionsPlugin,
  typescriptLanguagePlugin,

  codeHighlightPlugin,
  tooltipServicePlugin,
  typescriptTooltipsPlugin,
  completionServicePlugin,
  codeBlockRuntimePlugin,

  typescriptHighlightPlugin,
  typescriptCompletionsPlugin,
  typescriptFormattingServicePlugin,
  javascriptRuntimePlugin,

  httpHighlightPlugin,
  httpRuntimePlugin,

  tsRuntimePlugin,
  sqlRuntimePlugin,
  pythonRuntimePlugin
];

/**
 * 
 * @param {import('@milkdown/utils').$NodeSchema<string>} schema 
 */
function milkdownPluginFromSchema(schema) {
  return /** @type {import('@milkdown/ctx').MilkdownPlugin} */(/** @type {{}} */(schema));
}
