// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import { ReplaceAroundStep, ReplaceStep } from '@milkdown/prose/transform';

import { accessLanguageService } from '../../../typescript-services';
import { getCodeBlockRegionsOfEditorState } from '../state-block-regions';
import { getGlobalVariablesList } from '../state/runtime/plugin-runtime-service';

/**
 * @typedef {{
 *  fileName: string,
 *  index: number,
 *  block: import('../state-block-regions/find-code-blocks').CodeBlockNodeset,
 *  documentFrom: number,
 *  documentTo: number
 * }} TypeScriptCodeBlock
 */

class TypeScriptLanguagePlugin {
  /**
   * @param {import('@milkdown/prose/state').EditorStateConfig} config
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  constructor(config, editorState) {
    this.config = config;
    this.editorState = editorState;

    this.codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState) ||
    /**
     * @type {NonNullable<ReturnType<typeof getCodeBlockRegionsOfEditorState>>}
     */
    {
      codeBlocks: [],
      codeOnlyIteration: 0,
      codeOrPositionsIteration: 0
    };

    /** @type {TypeScriptCodeBlock[]} */
    this.codeBlockRegionsState = this.recalcCodeBlockRegionsState();

    /** @type {((tsCodeBlocks: ReturnType<TypeScriptLanguagePlugin['getTypeScriptCodeBlocks']>) => void)[]} */
    this.internalStateTriggers = [];

    // initialize asynchronously
    let langOrPromise = accessLanguageService(this.triggerInternalStateSubscribers);
    if (typeof langOrPromise.then === 'function') {
      langOrPromise.then(lang => {
        this.lang = lang;
        this.hydrateCodeBlockRegionsToLanguageService();
        this.triggerInternalStateSubscribers();
      });
    } else {
      this.lang = langOrPromise;
      this.hydrateCodeBlockRegionsToLanguageService();
    }
  }

  hydrateCodeBlockRegionsToLanguageService = () => {
    if (!this.lang) return; // this should never happen

    /** @type {import('../../../typescript-services').ScriptUpdates} */
    const updates = {};
    let anyUpdates = false;
    this.secretTypes =
      this.codeBlockRegions.codeBlocks.map((x, iBlock) =>
        '/** Implicit variable containing the result of execution of the corresponding script */ declare const $' + iBlock + ';'
      ).join('\n');

    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      const block = this.codeBlockRegions.codeBlocks[iBlock];
      const langType =
        block.language === 'TypeScript' ? this.lang.ts.ScriptKind.TSX :
          block.language === 'JavaScript' ? this.lang.ts.ScriptKind.JS :
            block.language === 'JSON' ? this.lang.ts.ScriptKind.JSON :
              undefined;

      if (!langType) continue;

      anyUpdates = true;
      const virtualFileName = codeBlockVirtualFileName(iBlock, /** @type {*} */(block.language));
      if (virtualFileName)
        updates[virtualFileName] = { from: 0, to: 0, newText: block.code };
    }

    updates['secretTypes.d.ts'] = {
      from: 0,
      to: 0,
      newText: this.secretTypes
    };

    console.log('TypeScriptLanguagePlugin initial update ', {
      updates,
      codeBlockRegions: this.codeBlockRegions
    });

    this.lang.update(updates);
  };

  /**
   * @param {import('@milkdown/prose/state').Transaction} tr
   * @param {import('@milkdown/prose/state').EditorState} oldEditorState
   * @param {import('@milkdown/prose/state').EditorState} newEditorState
   */
  apply = (tr, oldEditorState, newEditorState) => {
    if (!tr.docChanged) return;

    const codeBlocksRegions = getCodeBlockRegionsOfEditorState(newEditorState);

    if (!codeBlocksRegions) return;
    if (codeBlocksRegions.codeOrPositionsIteration === this.codeBlockRegions.codeOrPositionsIteration) {
      if (codeBlocksRegions.codeOnlyIteration === this.codeBlockRegions.codeOnlyIteration) {
        // code didn't change, but positions did - no need to update anything but regions themselves
        this.codeBlockRegions = codeBlocksRegions;
        return;
      }
    }

    const updates = deriveUpdatesForTransactionSteps(
      tr.steps,
      this.codeBlockRegions.codeBlocks || [],
      codeBlocksRegions.codeBlocks);

    this.codeBlockRegions = codeBlocksRegions;
    this.codeBlockRegionsState = this.recalcCodeBlockRegionsState();

    let newSecretTypes = this.codeBlockRegions.codeBlocks.map((x, iBlock) =>
      '/** Implicit variable containing the result of execution of the corresponding script */ declare const $' + iBlock + ';'
    ).join('\n');

    const globalVariables = getGlobalVariablesList(newEditorState) || getGlobalVariablesList(oldEditorState);
    if (globalVariables?.length) {
      newSecretTypes += '\n;var ' + globalVariables.join(', ') + ';';
    }

    if (this.secretTypes) {
      updates['secretTypes.d.ts'] = {
        from: 0,
        to: this.secretTypes.length,
        newText: newSecretTypes
      };
    } else {
      updates['secretTypes.d.ts'] = {
        from: 0,
        to: 0,
        newText: newSecretTypes
      };
    }

    this.secretTypes = newSecretTypes;

    if (!this.lang) return;

    this.lang.update(updates);
  };

  recalcCodeBlockRegionsState = () => {
    /** @type {TypeScriptCodeBlock[]} */
    const result = [];
    for (let iBlock = 0; iBlock < this.codeBlockRegions.codeBlocks.length; iBlock++) {
      const block = this.codeBlockRegions.codeBlocks[iBlock];
      const minCodeBlockPos = block.script.pos + 1;
      const maxCodeBlockPos = block.script.pos + block.script.node.nodeSize - 1;
      const codeBlockFileName = codeBlockVirtualFileName(iBlock, block.language);
      if (!codeBlockFileName) continue;
      result[iBlock] = {
        fileName: codeBlockFileName,
        index: iBlock,
        block: block,
        documentFrom: minCodeBlockPos,
        documentTo: maxCodeBlockPos
      };
    }

    return result;
  };

  triggerInternalStateSubscribers = () => {
    if (this.internalStateTriggers?.length) {
      const tsCodeBlocks = this.getTypeScriptCodeBlocks();
      for (const trigger of this.internalStateTriggers) {
        trigger(tsCodeBlocks);
      }
    }
  };

  getTypeScriptCodeBlocks = () => {
    return {
      tsBlocks: this.codeBlockRegionsState || [],
      lang: this.lang,
      codeOnlyIteration: this.codeBlockRegions.codeOnlyIteration,
      codeOrPositionsIteration: this.codeBlockRegions.codeOrPositionsIteration
    };
  };

}

const key = new PluginKey('TYPESCRIPT_LANGUAGE_SERVICES');
export const typescriptLanguagePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => new TypeScriptLanguagePlugin(config, editorState),
    apply: (tr, pluginState, oldState, newState) => {
      pluginState.apply(tr, oldState, newState);
      return pluginState;
    }
  }
});

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 */
export function getTypescriptLanguageServiceFromEditorState(editorState) {
  const pluginState = typescriptLanguagePlugin.getState(editorState);
  return pluginState?.lang;
}

/**
 * @param {import("prosemirror-transform").Step[]} steps
 * @param {import("../state-block-regions/find-code-blocks").CodeBlockNodeset[]} oldCodeBlockRegions
 * @param {import("../state-block-regions/find-code-blocks").CodeBlockNodeset[]} newCodeBlockRegions
 */
function deriveUpdatesForTransactionSteps(
  steps,
  oldCodeBlockRegions,
  newCodeBlockRegions
) {

  /** @type {import('../../../typescript-services').ScriptUpdates} */
  const updates = {};

  // TODO: apply transaction steps
  if (Math.sin(1) > 1) {
    for (const step of steps) {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) continue;

      for (let i = 0; i < oldCodeBlockRegions.length; i++) {
        const script = oldCodeBlockRegions[i].script;

        // TODO: which coordinate space is this in?
        // The original document, or document after previous steps ?
        const scriptFrom = script.pos + 1;
        const scriptTo = script.pos + script.node.nodeSize - 1;

        const overlaps = step.from < scriptTo && step.to >= scriptFrom;
        if (!overlaps) continue;
      }
    }
  }

  for (let iBlock = 0; iBlock < oldCodeBlockRegions.length; iBlock++) {
    const oldRegion = oldCodeBlockRegions[iBlock];
    const newRegion = newCodeBlockRegions[iBlock];

    const oldFileName =
      codeBlockVirtualFileName(iBlock, oldRegion.language);
    const newFileName =
      newRegion &&
      codeBlockVirtualFileName(iBlock, newRegion.language);

    if (!oldFileName) {
      if (newFileName) updates[newFileName] = { from: 0, to: 0, newText: newRegion.code };
    } else if (!newFileName) {
      updates[oldFileName] = null;
    } else if (oldFileName !== newFileName) {
      updates[oldFileName] = null;
      updates[newFileName] = { from: 0, to: 0, newText: newRegion.code }
    } else if (oldRegion.code !== newRegion.code) {
      // looking for changes

      let retainLead = 0;
      const minSize = Math.min(oldRegion.code.length, newRegion.code.length);

      for (retainLead = 0; retainLead < minSize; retainLead++) {
        if (oldRegion.code.charAt(retainLead) !== newRegion.code.charAt(retainLead)) {
          break;
        }
      }

      let retainTrail = 0;
      for (retainTrail = 0; retainLead + retainTrail < minSize; retainTrail++) {
        if (oldRegion.code.charAt(oldRegion.code.length - 1 - retainTrail) !==
          newRegion.code.charAt(newRegion.code.length - 1 - retainTrail)) {
          break;
        }
      }

      updates[newFileName] = {
        from: retainLead,
        to: oldRegion.code.length - retainTrail,
        newText: newRegion.code.substring(retainLead, newRegion.code.length - retainTrail)
      };
    }
  }

  for (let iBlock = oldCodeBlockRegions.length; iBlock < newCodeBlockRegions.length; iBlock++) {
    const newRegion = newCodeBlockRegions[iBlock];
    const newFileName =
      newRegion &&
      codeBlockVirtualFileName(iBlock, newRegion.language);

    if (newFileName)
      updates[newFileName] = { from: 0, to: 0, newText: newRegion.code };
  }

  return updates;
}

/**
 * @param {number} index
 * @param {'JavaScript' | 'TypeScript' | 'JSON' | string | null | undefined} lang
 */
export function codeBlockVirtualFileName(index, lang) {
  if (!lang) return undefined;
  const ext = (
    lang === 'TypeScript' ? '.tsx' :
      lang === 'JSON' ? '.json' :
        lang === 'JavaScript' ? '.mjs' :
          undefined
  );

  if (!ext) return undefined;
  return 'code-' + (index + 1) + ext;
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {number} pos
 */
export function resolveDocumentPositionToTypescriptCodeBlock(editorState, pos) {
  const pluginState = typescriptLanguagePlugin.getState(editorState);
  if (!pluginState) return;

  for (let iBlock = 0; iBlock < pluginState.codeBlockRegions.codeBlocks.length; iBlock++) {
    const block = pluginState.codeBlockRegions.codeBlocks[iBlock];
    const minCodeBlockPos = block.script.pos + 1;
    const maxCodeBlockPos = block.script.pos + block.script.node.nodeSize - 1;
    if (pos >= minCodeBlockPos && pos <= maxCodeBlockPos) {
      const tsBlock = pluginState.codeBlockRegionsState[iBlock];
      return {
        lang: pluginState.lang,
        ...tsBlock,
        pos: pos - minCodeBlockPos
      };
    }
  }
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 */
export function getTypeScriptCodeBlocks(editorState) {
  const pluginState = typescriptLanguagePlugin.getState(editorState);
  return pluginState?.getTypeScriptCodeBlocks() || {
    tsBlocks: [],
    lang: undefined,
    codeOnlyIteration: 0,
    codeOrPositionsIteration: 0
  };
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {TypeScriptLanguagePlugin['internalStateTriggers'][0]} handler
 */
export function onTypeScriptIternalStateChanged(editorState, handler) {
  const pluginState = typescriptLanguagePlugin.getState(editorState);
  pluginState?.internalStateTriggers.push(handler);

  return () => {
    if (!pluginState) return;
    const index = pluginState.internalStateTriggers.indexOf(handler);
    if (index >= 0) pluginState?.internalStateTriggers.splice(index, 1);
  };
}
