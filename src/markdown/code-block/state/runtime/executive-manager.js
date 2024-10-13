// @ts-check

import { Decoration, DecorationSet } from '@milkdown/prose/view';

import { getCodeBlockRegionsOfEditorState } from '../../state-block-regions';
import { ScriptRuntimeView } from './script-runtime-view';

export class ExecutiveManager {

  /**
   * @param {import('@milkdown/prose/state').EditorStateConfig} config
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  constructor(config, editorState) {
    this.config = config;
    this.editorState = editorState;

    /** @type {import('.').ExecutionRuntime[]} */
    this.runtimes = [];

    /** @type {import('.').DocumentRuntimeState} */
    this.documentState = {
      codeBlockStates: [],
      globalVariables: []
    };

    /** @type {(ScriptRuntimeView | undefined)[]} */
    this.scriptRuntimeViews = [];

    this.codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState);
    if (!this.codeBlockRegions) this.codeBlockRegions = { codeBlocks: [], codeOnlyIteration: -1 };
    this.codeBlockRegions.codeOnlyIteration = -1;
  }

  /**
   * @param {import('@milkdown/prose/state').Transaction} tr
   * @param {import('@milkdown/prose/state').EditorState} oldEditorState
   * @param {import('@milkdown/prose/state').EditorState} newEditorState
   */
  apply(tr, oldEditorState, newEditorState) {
    this.editorState = newEditorState;
    this.checkAndRerun(newEditorState);
  }

  /**
   * @param {import('@milkdown/prose/view').EditorView} editorView
   */
  initEditorView(editorView) {
    this.editorView = editorView;
    this.checkAndRerun(editorView.state);
  }

  getDecorationSet() {
    const decorations = [];
    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      const codeBlockRegion = this.codeBlockRegions.codeBlocks[iBlock];
      if (!codeBlockRegion.executionState) continue;
      const scriptState = this.documentState.codeBlockStates[iBlock];
      if (!scriptState) continue;

      const scriptView = this.scriptRuntimeViews[iBlock];
      if (!scriptView) continue;

      let pos = codeBlockRegion.executionState.pos + 1;
      for (const span of scriptView.renderedSpans) {
        if (typeof span === 'string') {
          pos += span.length;
          continue;
        }

        if (span.widget) {
          const deco = Decoration.widget(
            pos,
            span.widget,
            span.spec);
          decorations.push(deco);
        } else {
          const deco = Decoration.inline(
            pos,
            pos + span.textContent.length,
            {
              class: span.class
            });
          pos += span.textContent.length;
          decorations.push(deco);
        }

      }

      if (decorations.length)
        return DecorationSet.create(
          this.editorState.doc,
          decorations);
    }
  }

  /**
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  checkAndRerun(editorState) {
    const prevCodeOnlyIteration = this.codeBlockRegions.codeOnlyIteration;
    this.codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState) || this.codeBlockRegions;
    if (!this.editorView) {
      this.codeBlockRegions.codeOnlyIteration = -1;
      return;
    }

    if (this.codeBlockRegions.codeOnlyIteration === prevCodeOnlyIteration) return;

    const codeOnlyIteration = this.codeBlockRegions.codeOnlyIteration;

    this.reparseSetStaleAndActiveRuntimes();

    clearTimeout(this.debounceExecutionStart);
    this.debounceExecutionStart = setTimeout(async () => {
      this.updateWithDocState();
      if (this.codeBlockRegions.codeOnlyIteration !== codeOnlyIteration) return;
      await new Promise(resolve => setTimeout(resolve, 5));

      for await (const x of this.runCodeBlocks()) {
        if (this.codeBlockRegions.codeOnlyIteration !== codeOnlyIteration) break;

        this.updateWithDocState();

        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }, 400);
  }

  updateWithDocState() {
    if (!this.editorView) return;

    while (this.scriptRuntimeViews.length > this.codeBlockRegions.codeBlocks.length) {
      const last = this.scriptRuntimeViews.pop();
      if (last)
        last.destroy();
    }

    const applyChangesTransaction = this.editorView.state.tr
      .setMeta('updating document state to reflect script runtime state', true)
      .setMeta('addToHistory', false);

    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      const codeBlockRegion = this.codeBlockRegions.codeBlocks[iBlock];

      const scriptState = this.documentState.codeBlockStates[iBlock];
      const scriptView = this.scriptRuntimeViews[iBlock];
      if (!scriptState) {
        if (scriptView) {
          this.scriptRuntimeViews[iBlock] = undefined;
          scriptView.destroy();
        }
        continue;
      }

      if (scriptView) {
        scriptView.updateScriptState({
          scriptState,
          codeBlockRegion,
          runtime: this.activeRuntimes?.[iBlock]?.runtime,
          immediateTransaction: applyChangesTransaction
        });
      } else {
        this.scriptRuntimeViews[iBlock] = new ScriptRuntimeView({
          editorView: this.editorView,
          scriptState,
          codeBlockRegion,
          runtime: this.activeRuntimes?.[iBlock]?.runtime,
          immediateTransaction: applyChangesTransaction
        });
      }
    }

    this.editorView.dispatch(applyChangesTransaction);
  }

  async *runCodeBlocks() {
    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      const prevBlockState = this.documentState.codeBlockStates[iBlock];
      if (!prevBlockState) continue;
      const runtime = this.activeRuntimes?.[iBlock];
      if (!runtime) continue;

      let started = Date.now();

      this.documentState = {
        ...this.documentState,
        codeBlockStates: this.documentState.codeBlockStates.slice()
      };
      this.documentState.codeBlockStates[iBlock] = {
        phase: 'executing',
        started,
        logs: [],
        stale: propagateToStale(prevBlockState)
      };

      this.executingScriptIndex = iBlock;
      yield;

      started = Date.now();
      try {
        const result = await runtime.runtime.runCodeBlock(iBlock);
        const completed = Date.now();
        yield;

        this.documentState = {
          ...this.documentState,
          codeBlockStates: this.documentState.codeBlockStates.slice()
        };

        const prevBlockState = /** @type {import('.').ScriptRuntimeStateExecuting} */(this.documentState.codeBlockStates[iBlock]);

        this.documentState.codeBlockStates[iBlock] = {
          phase: 'succeeded',
          started,
          completed,
          logs: prevBlockState.logs,
          result
        };
        yield;

      } catch (error) {
        const completed = Date.now();
        yield;

        this.documentState = {
          ...this.documentState,
          codeBlockStates: this.documentState.codeBlockStates.slice()
        };

        const prevBlockState = /** @type {import('.').ScriptRuntimeStateExecuting} */(this.documentState.codeBlockStates[iBlock]);

        this.documentState.codeBlockStates[iBlock] = {
          phase: 'failed',
          started,
          completed,
          logs: prevBlockState.logs,
          error
        };

        yield;
      }
    }

    this.executingScriptIndex = -1;
  }

  reparseSetStaleAndActiveRuntimes() {

    this.executingScriptIndex = -1;

    const documentState = {
      ...this.documentState
    };
    documentState.codeBlockStates = documentState.codeBlockStates.slice();
    documentState.globalVariables = documentState.globalVariables.slice();

    // destroy outdated blocks
    documentState.codeBlockStates.length = this.codeBlockRegions.codeBlocks.length;

    /** @type {Set<string>} */
    const globalVariables = new Set();
    /** @type {ReturnType<import('.').ExecutionRuntime['parse']>} */
    const combinedRuntimeStateOutputs = [];

    /** @type {{ runtime: import('.').ExecutionRuntime }[]} */
    const runtimeForCodeBlock = [];

    for (const runtime of this.runtimes) {
      const runtimeCodeBlockStates = runtime.parse(this.codeBlockRegions.codeBlocks, this.editorState);
      for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
        const state = runtimeCodeBlockStates[iBlock];
        if (!state) continue;
        if (state.variables) {
          for (const v of state.variables) {
            globalVariables.add(v);
          }
        }

        const stateOfBlock = combinedRuntimeStateOutputs[iBlock];
        if (stateOfBlock) {
          // combine states from multiple runtimes?
          // should not really be a thing!!
          // /** @type {string[]} */
          // const combinedVariables = [...new Set([...(stateOfBlock?.variables || []), ...(state.variables || [])])];
          // combinedRuntimeStateOutputs[iBlock] = {
          //   ...stateOfBlock,
          //   ...state,
          //   variables: combinedVariables
          // };
        } else {
          combinedRuntimeStateOutputs[iBlock] = state;
          runtimeForCodeBlock[iBlock] = { runtime };
        }
      }
    }

    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      let prevScriptRuntimeState = documentState.codeBlockStates[iBlock];
      const runtimeStateOutput = combinedRuntimeStateOutputs[iBlock];
      if (!runtimeStateOutput) {
        if (prevScriptRuntimeState) {
          documentState.codeBlockStates[iBlock] = {
            phase: 'unknown',
            stale: propagateToStale(prevScriptRuntimeState)
          };
        }
        continue;
      }

      documentState.codeBlockStates[iBlock] = {
        phase: 'parsed',
        variables: runtimeStateOutput.variables,
        stale: prevScriptRuntimeState && propagateToStale(prevScriptRuntimeState)
      };
    }

    documentState.globalVariables = [];
    // this.documentState.globalVariables = [...globalVariables];

    this.documentState = documentState;

    this.activeRuntimes = runtimeForCodeBlock;
  }

  /**
   * @param {import('.').ExecutionRuntime} runtime
   * @param {import('.').LogOutput} output
   */
  handleRuntimeLog = (runtime, output) => {
    let matchingBlock = typeof this.executingScriptIndex !== 'number' ? undefined :
      this.documentState.codeBlockStates[this.executingScriptIndex];

    if (!matchingBlock) {
      matchingBlock = this.documentState.codeBlockStates.filter(Boolean).reverse().slice(-1)[0];

      if (!matchingBlock) {
        console.warn('No block expects logs ', runtime, output);
        return;
      }
    }

    const newMatchingBlockLogs = /** @type {*} */(matchingBlock).logs || [];
    newMatchingBlockLogs.push(output);

    this.documentState = {
      ...this.documentState,
      codeBlockStates: this.documentState.codeBlockStates.map((anyBlock) =>
        anyBlock !== matchingBlock ? anyBlock :
          {
            ...matchingBlock,
            logs: newMatchingBlockLogs
          })
    }
  };

  /**
   * 
   * @param {import('.').ExecutionRuntime} runtime 
   */
  registerRuntime(runtime) {
    this.runtimes.push(runtime);
    runtime.onLog = (output) => this.handleRuntimeLog(runtime, output);
    this.checkAndRerun(this.editorState)
  }
}

/**
 * @param {import('.').ScriptRuntimeState} scriptState
 * @returns {import('.').ScriptRuntimeStateSucceeded | import('.').ScriptRuntimeStateFailed | undefined}
 */
function propagateToStale(scriptState) {
  if (scriptState.phase === 'succeeded' || scriptState.phase === 'failed')
    return scriptState;
}
