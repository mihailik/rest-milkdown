// @ts-check

import { defaultValueCtx, editorStateCtx, editorViewCtx, prosePluginsCtx, rootCtx } from '@milkdown/core';
import { Plugin, PluginKey, Selection, TextSelection, Transaction } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { ReplaceAroundStep, ReplaceStep } from '@milkdown/prose/transform';

import { withPromiseOrSync } from '../../../with-promise-or-sync';
import { makeLanguageService } from '../lang-service';
import { codeBlockExecutionState } from '../schema';
import { findCodeBlocks, findOverlappingCodeBlocks, getTransactionCodeBlocks } from './find-code-blocks';
import { modifiesExecutionStateBlocks } from './modifies-execution-state-blocks';
import { execIsolation } from './exec-isolation';

/**
 * @typedef {import('./find-code-blocks').CodeBlockNodeset & {
 *  ast?: import('typescript').SourceFile,
 *  transformedCode?: string,
 *  executionStarted?: number,
 *  executionEnded?: number,
 *  succeeded?: boolean,
 *  error?: any,
 *  result?: any
 * }} CodeBlockState
 */

/**
 * @typedef {{
 *  current: number,
 *  blocks: CodeBlockState[],
 *  ts?: typeof import('typescript'), 
 *  program?: import('typescript').Program
 * }} DocumentCodeState
 */

const setLargeResultAreaText = 'setLargeResultAreaText';
const setSyntaxDecorations = 'setSyntaxDecorations';

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
export function createCodeBlockStatePlugin(ctx) {
  const pluginKey = new PluginKey('CODE_BLOCK_STATE');
  const codeBlockStatePlugin = new Plugin({
    key: pluginKey,
    filterTransaction: (tr, state) => {
      // let the code result changes flow normally
      if (tr.getMeta(setLargeResultAreaText)) return true;

      return !modifiesExecutionStateBlocks(tr);
    },
    state: {
      init: () => /** @type {{ docState: DocumentCodeState } | null} */(null),
      apply: (tr, prev) => {
        if (!prev) {
          const docState = { current: 0, blocks: findCodeBlocks(tr.doc) };
          processDocState(ctx, tr.doc, docState);
          return { docState };
        }

        if (!tr.docChanged) return prev;

        const docState = prev.docState;
        updateDocState(ctx, tr.doc, docState, findCodeBlocks(tr.doc));
        return { docState };
      }
    },
    props: {
      decorations(state) {
        const decorations = getSyntaxDecorations(this.getState(state)?.docState);
        const decorationSet = DecorationSet.create(state.doc, decorations);
        if (decorations.length) {
          console.log('decorations', decorations);
        }
        return decorationSet;
      }
    }
  });

  return codeBlockStatePlugin;

  /** @type {ReturnType<typeof makeLanguageService> | undefined} */
  var ls;

  /**
   * @template T
   * @param {(ls: Awaited<ReturnType<typeof makeLanguageService>>) => T} callback
   * @returns {T | Promise<T>}
   */
  function withLanguageService(callback) {
    if (!ls) ls = makeLanguageService();
    return withPromiseOrSync(ls, callback);
  }

  /**
   * @param {import("@milkdown/ctx").Ctx} ctx
   * @param {import("prosemirror-model").Node} doc
   * @param {DocumentCodeState} docState
   * @param {import("./find-code-blocks").CodeBlockNodeset[]} newCodeBlockNodes
   */
  function updateDocState(ctx, doc, docState, newCodeBlockNodes) {
    if (docState.blocks.length === newCodeBlockNodes.length) {
      let changed = false;
      for (let i = 0; i < docState.blocks.length; i++) {
        if (docState.blocks[i].code !== newCodeBlockNodes[i].code) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        for (let i = 0; i < docState.blocks.length; i++) {
          const existingNode = docState.blocks[i];
          const newNodeset = newCodeBlockNodes[i];
          existingNode.block = newNodeset.block;
          existingNode.backtick = newNodeset.backtick;
          existingNode.script = newNodeset.script;
          existingNode.executionState = newNodeset.executionState;
        }

        if (docState.blocks.length && !docState.blocks[0].executionStarted)
          return processDocState(ctx, doc, docState);

        return;
      }
    }

    const prevBlocks = docState.blocks;
    docState.blocks = newCodeBlockNodes;
    docState.program = undefined;

    return processDocState(ctx, doc, docState);
  }

  /** @type {ReturnType<typeof createLiveExecutionState> | undefined} */
  var liveExecutionState;

  /**
* @param {import("@milkdown/ctx").Ctx} ctx
* @param {import("prosemirror-model").Node} doc
* @param {DocumentCodeState} docState
*/
  function processDocState(ctx, doc, docState) {
    const current = docState.current;
    return withLanguageService(ls => {
      if (docState.current !== current) return;

      updateAst(docState, ls);

      if (!liveExecutionState) liveExecutionState = createLiveExecutionState(ctx);
      liveExecutionState.executeCodeBlocks(docState).then(() => {
        const editorView = ctx.get(editorViewCtx);
        const tr = editorView.state.tr;
        tr.setMeta(setSyntaxDecorations, true);
        editorView.dispatch(tr);
      });
    });
  }

}

/**
 * 
 * @param {DocumentCodeState} docState
 * @param {Awaited<ReturnType<typeof makeLanguageService>>} ls 
 */
function updateAst(docState, ls) {
  ls.scripts = {};

  for (let i = 0; i < docState.blocks.length; i++) {
    const node = docState.blocks[i];
    ls.scripts[codeBlockVirtualFileName(docState, i)] = node.code;
  }

  docState.ts = ls.ts;
  docState.program = ls.languageService.getProgram();
  for (let i = 0; i < docState.blocks.length; i++) {
    const node = docState.blocks[i];
    node.ast = docState.program?.getSourceFile(codeBlockVirtualFileName(docState, i));
  }
}

/**
 * @param {DocumentCodeState} docState
 * @param {number} index
 */
function codeBlockVirtualFileName(docState, index) {
  return 'code' + (index + 1) + '.ts';
}

/**
 * @param {DocumentCodeState | undefined} docState
 */
function getSyntaxDecorations(docState) {
  let decorations = [];

  const ts = docState?.ts;
  if (ts) {
    for (let i = 0; i < docState.blocks.length; i++) {
      const { script, code, ast } = docState.blocks[i];
      if (!ast) continue;

      /** @param {import('typescript').Node} tsNode */
      const visit = tsNode => {
        if (tsNode.getChildCount()) {
          ts.forEachChild(tsNode, visit);
          return;
        }

        if (tsNode.pos === tsNode.end) return;
        const classNames = [];
        for (const syntaxKindName in ts.SyntaxKind) {
          const syntaxKind = ts.SyntaxKind[syntaxKindName];
          if (typeof syntaxKind === 'number' && (syntaxKind & tsNode.kind) === syntaxKind) {
            classNames.push('ts-' + syntaxKindName);
          }
        }

        const lead = tsNode.getLeadingTriviaWidth();

        const deco = Decoration.inline(
          script.pos + tsNode.pos + 1 + lead,
          script.pos + tsNode.end + 1,
          { class: classNames.join(' ') }
        );
        decorations.push(deco);
      };

      ts.forEachChild(ast, visit);
    }
  }

  return decorations;
}

/**
 * @param {import("@milkdown/ctx").Ctx} ctx
 */
function createLiveExecutionState(ctx) {

  return {
    executeCodeBlocks
  };

  /** @type {ReturnType<import('./exec-isolation').execIsolation> | undefined} */
  var isolation;

  /**
   * @param {DocumentCodeState} docState
   */
  async function executeCodeBlocks(docState) {
    const current = docState.current;

    await new Promise(resolve => setTimeout(resolve, 10));
    if (docState.current !== current) return;

    for (let iBlock = 0; iBlock < docState.blocks.length; iBlock++) {
      if (docState.current !== current) return;

      const block = docState.blocks[iBlock];

      try {
        if (!block.ast) {
          block.succeeded = false;
          block.error = 'No AST';
          continue;
        }

        //block.transformedCode = ls.languageService.transformCode(block.ast);
        block.executionStarted = Date.now();
        if (!isolation) isolation = execIsolation();
        block.result = await isolation.execScriptIsolated(block.code);
        block.executionEnded = Date.now();
        block.succeeded = true;
        console.log('result', block);

        let resultText =
          typeof block.result === 'function' ? block.result.toString() :
            !block.result ? typeof block.result + (String(block.result) === typeof block.result ? '' : ' ' + String(block.result)) :
              JSON.stringify(block.result, null, 2);
        setResultStateText(block, resultText);

      } catch (error) {
        block.error = error;
        block.succeeded = false;
        console.log('result', block);

        const errorText = error?.stack ? error.stack : String(error);

        setResultStateText(block, errorText);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
 * @param {CodeBlockState} block
 * @param {string} text
 */
  function setResultStateText(block, text) {
    const editorView = ctx.get(editorViewCtx);
    if (block.executionState) {
      const tr = text ?
        editorView.state.tr
          .replaceRangeWith(
            block.executionState.pos + 1,
            block.executionState.pos + block.executionState.node.nodeSize - 1,
            editorView.state.schema.text(text)) :
        editorView.state.tr
          .deleteRange(block.executionState.pos + 1,
            block.executionState.pos + block.executionState.node.nodeSize - 1);
      tr.setMeta(setLargeResultAreaText, true);

      editorView.dispatch(tr);
      console.log('replaced execution_state with result ', tr);
    } else {
      const newExecutionStateNode = codeBlockExecutionState.type(ctx).create(
        {},
        !text ? undefined : editorView.state.schema.text(text));

      const tr = editorView.state.tr
        .insert(
          block.script.pos + block.script.node.nodeSize,
          newExecutionStateNode);
      tr.setMeta(setLargeResultAreaText, true);
      editorView.dispatch(tr);
    }

  }
  
}

