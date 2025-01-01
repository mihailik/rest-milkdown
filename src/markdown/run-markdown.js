// @ts-check

import { defaultValueCtx, editorStateCtx, editorViewCtx, parserCtx, prosePluginsCtx, remarkCtx, rootCtx } from '@milkdown/core';
// import { Crepe } from '@milkdown/crepe';
import { commandsCtx, Editor, editorCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { codeBlockAttr, codeBlockSchema, commonmark, createCodeBlockInputRule, toggleEmphasisCommand, toggleStrongCommand } from '@milkdown/kit/preset/commonmark';
import { history } from '@milkdown/plugin-history';
import { indent } from '@milkdown/plugin-indent';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { math } from '@milkdown/plugin-math';
import { trailing } from '@milkdown/plugin-trailing';
import { gfm } from '@milkdown/preset-gfm';
import { Slice } from '@milkdown/prose/model';

// import "@milkdown/theme-nord/style.css";

import { updateFontSizeToContent } from '../font-size';
import { applyModifier } from '../unicode-formatting/apply-modifier';
import { runParseRanges } from '../unicode-formatting/run-parse-ranges';
import { codeBlockPlugins } from './code-block';
import { getCodeBlockRegionsOfEditorState } from './code-block/state-block-regions';
import { formattingButtonsPlugin } from './formatting-buttons';
import { NO_UNICODE_AUTOFORMAT_TRANSACTION } from './unicode-formatting/adjust-typing-transaction';
import { createCarryFormattingPlugin as createCarryUnicodeFormatProsemirrorPlugin } from './unicode-formatting/carry-formatting-plugin';
import { createKeymapPlugin as createUnicodeFormatterKeymapProsemirrorPlugin } from './unicode-formatting/keymap-plugin';
import { updateLocationTo } from './update-location-to';
import { updateMarkdownButtons, wireUpMarkdownButtons } from './update-markdown-buttons';
import { updateUnicodeButtons, wireUpButtons } from './update-unicode-buttons';
import { restoreSelectionFromWindowName, storeSelectionToWindowName } from './window-name-selection';

import './katex-part.css';
import './milkdown-neat.css';

const defaultText = '🆃𝘆𝗽𝗲  ৳໐  🆈𝒐𝓾𝓻𝓼𝒆𝓵𝓯';

/**
 * @param {HTMLElement} host
 * @param {string} [markdownText]
 */
export async function runMarkdown(host, markdownText) {

  const excludeCodeBlockPlugins = [
    codeBlockAttr,
    codeBlockSchema,
    createCodeBlockInputRule,
  ]

  const commonmarkSansCodeBlock = commonmark.filter(plugin => {
    return !excludeCodeBlockPlugins.includes(/** @type {*} */(plugin));
  });

  let carryMarkdownText = typeof markdownText === 'string' ? markdownText : defaultText;

  let updateButtons = () => { };

  const editor = Editor.make()
    .use(commonmarkSansCodeBlock)
    .use(gfm)
    .use(history)
    .use(indent)
    .use(trailing)
    .use(math)
    .use(clipboard)
    .use(codeBlockPlugins)
    .use(listener)
    .config(ctx => {
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, carryMarkdownText);
      ctx.get(listenerCtx).markdownUpdated(handleMarkdownUpdate);
      wireUpButtons(ctx);
      wireUpMarkdownButtons(ctx);
      ctx.update(prosePluginsCtx, plugins => {
        const editorState = ctx.get(editorStateCtx);
        const logicalTitle = getLogicalTitle(editorState.doc);
        updateLocationTo(carryMarkdownText, 'text', logicalTitle);

        updateButtons = createButtonUpdaterDebounced(ctx, () => carryMarkdownText);

        return [
          ...plugins,
          createCarryUnicodeFormatProsemirrorPlugin(updateButtons),
          createUnicodeFormatterKeymapProsemirrorPlugin(updateButtons),
          formattingButtonsPlugin
        ];
      });

      setTimeout(() => {
        const editorView = ctx.get(editorViewCtx);
        restoreSelectionFromWindowName(editorView, carryMarkdownText);
        editorView.focus();
        updateUnicodeButtons(ctx);

        const logicalTitle = getLogicalTitle(editorView.state.doc);
        if (logicalTitle) {
          document.title = applyModifier(logicalTitle, 'bold');
        } else {
          document.title = '𝗺𝗼𝗰𝗸𝘂𝗺𝗲𝗻𝘁';
        }

        const editorState = ctx.get(editorStateCtx);
        const codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState);
        const setToMinimal = !!codeBlockRegions?.codeBlocks.length;

        updateFontSizeToContent(host, host.innerText, setToMinimal);
      }, 1);
    });

  const editorCreated = await editor.create();
  editor.action((ctx) => {
    injectLineBreakParserAdjustment(ctx);
    const view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const doc = carryMarkdownText && parser(carryMarkdownText);
    if (!doc) return;
    const state = view.state;
    view.dispatch(
      state.tr
        .setMeta('addToHistory', false)
        .setMeta(NO_UNICODE_AUTOFORMAT_TRANSACTION, true)
        .replace(
          0,
          state.doc.content.size,
          new Slice(doc.content, 0, 0)
        ));
  });

  console.log('editor ', editor, ' created ', editorCreated);

  /**
   * @param {import("@milkdown/ctx").Ctx} ctx
   * @param {string} markdownText
   * @param {string} prevMarkdown
   */
  function handleMarkdownUpdate(ctx, markdownText, prevMarkdown) {
    carryMarkdownText = markdownText;
    const editorState = ctx.get(editorStateCtx);
    const logicalTitle = getLogicalTitle(editorState.doc);
    updateLocationTo(markdownText, 'text', logicalTitle);

    const editorView = ctx.get(editorViewCtx);
    storeSelectionToWindowName(editorView, markdownText);

    queueUpdateFontSize(ctx);
  }

  var fontSizeUpdateTimeout;
  /**
   * @param {import("@milkdown/ctx").Ctx} ctx
   */
  function queueUpdateFontSize(ctx) {
    clearTimeout(fontSizeUpdateTimeout);
    fontSizeUpdateTimeout = setTimeout(() => {
      const editorState = ctx.get(editorStateCtx);
      const codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState);
      const setToMinimal = !!codeBlockRegions?.codeBlocks.length;

      updateFontSizeToContent(host, host.innerText, setToMinimal);
    }, 700);
  }

}

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 * @param {() => string} getCurrentMarkdownText
 */
function createButtonUpdaterDebounced(ctx, getCurrentMarkdownText) {

  var updateDebounceTimeout = 0;

  return updateButtonsDebounced;

  function updateButtonsDebounced() {
    clearTimeout(updateDebounceTimeout);
    updateDebounceTimeout = /** @type {*} */(setTimeout(() => {
      updateUnicodeButtons(ctx);
      updateMarkdownButtons(ctx);

      const editorView = ctx.get(editorViewCtx);
      storeSelectionToWindowName(editorView, getCurrentMarkdownText());
    }, 200));
  }
}

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
function injectLineBreakParserAdjustment(ctx) {
  const remark = ctx.get(remarkCtx);
  /** @type {typeof remark.parse} */
  const oldParse = remark.parse.bind(remark);
  remark.parse = (content) => {
    const parsedMarkdownWithPositions = oldParse(content);
    const adjustedChildren = [parsedMarkdownWithPositions.children[0]];
    for (let iPara = 1; iPara < parsedMarkdownWithPositions.children.length; iPara++) {
      const prev = parsedMarkdownWithPositions.children[iPara - 1];
      const current = parsedMarkdownWithPositions.children[iPara];
      if (prev.position && current.position && typeof prev.position.end.offset === 'number') {
        const excessLineGap = (current.position.start.line - prev.position.end.line) / 2 - 1;
        if (excessLineGap) {
          for (let iGapFill = 0; iGapFill < excessLineGap; iGapFill++) {
            adjustedChildren.push({
              type: 'paragraph',
              children: [],
              position: {
                start: {
                  line: prev.position.end.line + 1 + iGapFill,
                  column: 1,
                  offset: prev.position.end.offset + 1 + iGapFill,
                },
                end: {
                  line: prev.position.end.line + 1 + iGapFill,
                  column: 1,
                  offset: prev.position.end.offset + 1 + iGapFill,
                },
              },
            })
          };
        }
      }

      adjustedChildren.push(current);
    }

    parsedMarkdownWithPositions.children = adjustedChildren;
    return parsedMarkdownWithPositions;
  };

  remark['__tag'] = 'adjusted';
  console.log('remark adjustments ', remark.parse, oldParse, { adjusted: remark, requery: ctx.get(remarkCtx) });
}

/**
 * 
 * @param {import('@milkdown/prose/state').EditorState['doc'] | undefined} doc 
 */
function getLogicalTitle(doc) {
  if (!doc) return;

  /** @type {import('@milkdown/prose/model').Node[]}*/
  const allNodes = [];
  doc.nodesBetween(1, doc.content.size, (node) => {
    allNodes.push(node);
  });

  allNodes.sort((n1, n2) => {
    return getTitleOrder(n1) - getTitleOrder(n2);
  });

  const titleNode = allNodes[0];
  if (titleNode) {
    const title = titleNode.textContent;
    const parsedTitle = runParseRanges(title);
    const normalizedTitle =
      (parsedTitle ? parsedTitle.map(entry => typeof entry === 'string' ? entry : entry.plain).join('') : title);

    return normalizedTitle;
  }

  /**
   * @param {import("prosemirror-model").Node} node
   */
  function getTitleOrder(node) {
    if (node.type.name === 'heading') {
      return node.attrs.level;
    }

    if (node.type.name === 'paragraph') {
      return 100;
    }

    if (node.type.name === 'blockquote') {
      return 200;
    }

    if (node.type.name === 'code_block') {
      return 300;
    }

    return 1000;
  }
}
