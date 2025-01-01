// @ts-check

import { Plugin, PluginKey, Transaction } from '@milkdown/prose/state';
import { ReplaceAroundStep, ReplaceStep } from '@milkdown/prose/transform';
import { Decoration, DecorationSet } from '@milkdown/prose/view';

import { getCodeBlockRegionsOfEditorState } from '../state-block-regions';
import { hideTooltipTemporarilyForEditorState, releaseHiddenTooltipForEditorState } from './plugin-tooltip-service';
import { resolveDocumentPositionToCodeBlock } from '../state-block-regions/plugin';

/**
 * @typedef {(args: {
 *  editorView: import('@milkdown/prose/view').EditorView,
 *  editorState: import('@milkdown/prose/state').EditorState,
 *  codeBlockIndex: number,
 *  codeBlockRegion: import('../state-block-regions/find-code-blocks').CodeBlockNodeset,
 *  documentPos: number,
 *  codeOffset: number
 * }) => CodeCompletionSet | undefined} CompletionProvider
 */

/**
 * @typedef {{
 *  targetStart: number,
 *  targetEnd: number,
 *  completions: CodeCompletion[]
 * }} CodeCompletionSet
 */

/**
 * @typedef {{
 *  recommended?: boolean,
 *  element: HTMLElement,
 *  apply: string | (() => void)
 * }} CodeCompletion
 */

const SELECTED_COMPLETION_MENU_ITEM_CLASS = 'completions-menu-item-selected';

class CodeCompletionService {
  /**
   * @param {import('@milkdown/prose/state').EditorStateConfig} config
   * @param {import('@milkdown/prose/state').EditorState} editorState
   */
  constructor(config, editorState) {
    this.config = config;
    this.editorState = editorState;

    /** @type {import('@milkdown/prose/view').EditorView | undefined} */
    this.editorView = undefined;

    /**
     * @type {CompletionProvider[]}
     */
    this.completionProviders = [];

    /**
     * @type {DecorationSet | undefined}
     */
    this.decorations = undefined;

    /**
     * @type {{
     *  codeBlockIndex: number,
     *  scriptCursorOffset: number,
     *  scriptTargetStart: number,
     *  scriptTargetEnd: number,
     *  completions: CodeCompletion[],
     *  menuElement: HTMLElement | undefined,
     *  selectedCompletion: number | undefined
     * } | undefined}
     */
    this.currentCompletions = undefined;
    this.tooltipsHidden = false;
  }

  /**
   * @param {import('@milkdown/prose/state').Transaction} tr
   * @param {import('@milkdown/prose/state').EditorState} oldEditorState
   * @param {import('@milkdown/prose/state').EditorState} newEditorState
   */
  apply = (tr, oldEditorState, newEditorState) => {
    this.editorState = newEditorState;

    // detect when to pop, detect when to apply
    if (!tr.docChanged) {
      if (tr.selectionSet) {
        this.closeCompletions('cancel', false);
      }
      return;
    }

    const inserted = insertedInTransaction(tr);

    if (this.currentCompletions) {
      // check if need to close completions, or maybe update completions
      // check if need to open completions
      const shouldCloseCompletions =
        inserted &&
          inserted.text.length === 1 ?
          (
            /[\p{P}\.]/ui.test(inserted.text) ? 'cancel' :
              /[\s\.,+\!\-\(\)\/\*]/i.test(inserted.text) ? 'proceed' :
                undefined
          ) :
          undefined;

      if (shouldCloseCompletions) {
        this.closeCompletions(shouldCloseCompletions, false);
        const doc = this.editorState.doc;
        setTimeout(() => {
          if (this.editorView?.state.doc.eq(doc)) {
            this.updateCompletions();
          }
        }, 1);
      } else {
        this.updateCompletions();
      }
    } else {
      // check if need to open completions
      if (inserted) {
        const block = resolveDocumentPositionToCodeBlock(newEditorState, inserted?.from);
        if (block) {

          const singleChar =
            [...inserted.text].length === 1 &&
            inserted.text || '';

          const prevChar = block.code.slice(
            Math.max(0, block.codePos - 1),
            block.codePos);

          const shouldOpenCompletions =
            /\p{L}/ui.test(singleChar) && prevChar !== '\n' ||
            singleChar === '.' && prevChar !== '.';

          if (shouldOpenCompletions) {
            this.showCompletions();
          }
        }
      }
    }
  };

  updateCompletions = () => {
    this.decorations = undefined;
    if (!this.editorView) return;
    const codeBlockRegions = getCodeBlockRegionsOfEditorState(this.editorState);
    if (!codeBlockRegions) return;

    const documentCursorOffset = this.editorState.selection.head;
    let iBlock = 0;
    for (iBlock = 0; iBlock < codeBlockRegions.codeBlocks.length; iBlock++) {
      const block = codeBlockRegions.codeBlocks[iBlock];
      if (documentCursorOffset >= block.script.pos && documentCursorOffset <= block.script.pos + block.script.node.nodeSize) {
        break;
      }
    }

    if (iBlock >= codeBlockRegions.codeBlocks.length) return;

    const codeBlockRegion = codeBlockRegions.codeBlocks[iBlock];
    const scriptCursorOffset = documentCursorOffset - (codeBlockRegion.script.pos + 1);

    // no completions at the beginning of the word
    if (!scriptCursorOffset || /\s/.test(codeBlockRegion.code.charAt(scriptCursorOffset - 1))) return;

    for (const provider of this.completionProviders) {
      const completions = provider({
        editorView: this.editorView,
        editorState: this.editorState,
        codeBlockIndex: iBlock,
        codeBlockRegion,
        documentPos: documentCursorOffset,
        codeOffset: scriptCursorOffset
      });
      if (!completions?.completions.length) continue;

      if (!this.tooltipsHidden) {
        hideTooltipTemporarilyForEditorState(this.editorState);
        this.tooltipsHidden = true;
      }

      this.currentCompletions = {
        codeBlockIndex: iBlock,
        scriptCursorOffset,
        scriptTargetStart: completions.targetStart,
        scriptTargetEnd: completions.targetEnd,
        completions: completions.completions,
        menuElement: undefined,
        selectedCompletion: undefined
      };

      const completionsMenuElement = document.createElement('div');
      completionsMenuElement.className = 'completions-menu';
      completionsMenuElement.style.position = 'absolute';
      completionsMenuElement.style.display = 'inline-block';
      if (this.currentCompletions) this.currentCompletions.menuElement = completionsMenuElement;
      let addedMenuItemCount = 0;
      for (let iCo = 0; iCo < completions.completions.length; iCo++) {
        const coEl = completions.completions[iCo];
        coEl.element.classList.add('completions-menu-item');
        ((iCo) => {
          coEl.element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.editorView) return;
            this.updateCompletionIndex(iCo);
            this.closeCompletions('accept', true);
            this.editorView.dispatch(this.editorState.tr.setMeta('confirming completion by click', coEl));
          });
          const insertedAt = Date.now();
          coEl.element.addEventListener('mouseenter', () => {
            if (Date.now() - insertedAt < 200) return;
            if (this.currentCompletions?.selectedCompletion === iCo) return;
            this.updateCompletionIndex(iCo);
          });
        })(iCo);

        completionsMenuElement.appendChild(coEl.element);
        if (coEl.recommended &&
          this.currentCompletions && typeof this.currentCompletions.selectedCompletion !== 'number') {
          this.currentCompletions.selectedCompletion = iCo;
          coEl.element.classList.add('completions-menu-item-selected');
        }

        addedMenuItemCount++;
        if (addedMenuItemCount > 30) break;
      }

      if (addedMenuItemCount) {
        console.log(
          'completions ',
          codeBlockRegion.code.slice(0, completions.targetStart) + '|' +
          codeBlockRegion.code.slice(completions.targetStart, this.currentCompletions.scriptCursorOffset) + '|' +
          codeBlockRegion.code.slice(this.currentCompletions.scriptCursorOffset, completions.targetEnd) + '...' ,
          completions,
          codeBlockRegion.code.length,
          codeBlockRegion.script.node.nodeSize - 2
        );

        // BUG: ProseMirror struggles to keep typing when a widget is inserted next to the cursor
        const startBehind = completions.targetStart &&
          codeBlockRegion.code.slice(completions.targetStart - 1, completions.targetStart) !== '\n';

        this.decorations = DecorationSet.create(this.editorState.doc, [
          Decoration.widget(
            codeBlockRegion.script.pos + 1 + completions.targetStart + (startBehind ? -1 : 0),
            completionsMenuElement,
            {
              side: -1,
              ignoreSelection: true
            }
          )
        ]);
      }

      return;
    }
  };

  /**
   * @param {KeyboardEvent} event 
   */
  handleKeyDown = (event) => {
    if (!this.editorView) return;

    let applied = false;
    let key = event.key;
    if (key === ' ') key = 'Space';
    if (event.altKey && !/alt/i.test(key || '')) key = 'Alt+' + key;
    if (event.shiftKey && !/shift/i.test(key || '')) key = 'Shift+' + key;
    if (event.ctrlKey && !/ctrl|control/i.test(key || '')) key = 'Ctrl+' + key;
    if (event.metaKey && !/meta|cmd|win/i.test(key || '')) key = 'Meta+' + key;

    if (this.currentCompletions) {
      switch (key) {
        case 'Enter':
        case 'Tab':
          this.closeCompletions('accept', true);
          applied = true;
          break;

        case 'Escape':
          this.closeCompletions('cancel', true);
          applied = true;
          break;

        // case ' ':
        // case '.':
        // case ',':
        // case '(':
        // case ')':
        // case '?':
        //   this.closeCompletions('proceed', true);
        //   applied = true;
        //   break;

        case 'ArrowUp':
          this.highlightCompletionUp();
          applied = true;
          break;

        case 'ArrowDown':
          this.highlightCompletionDown();
          applied = true;
          break;
      }
    } else {
      switch (key) {
        case 'Ctrl+Space':
        case 'Alt+Space':
        case 'Alt+Escape':
          this.showCompletions();
          applied = true;
          break;
      }
    }

    if (applied) {
      this.editorView.dispatch(this.editorState.tr.setMeta('refresh completions decorations', true));
      return true;
    }
  };

  showCompletions = () => {
    this.updateCompletions();
  };

  /**
   * @param {'accept' | 'cancel' | 'proceed'} closeMode 
   * @param {boolean} immediately
   */
  closeCompletions = (closeMode, immediately) => {
    if (!this.currentCompletions || !this.editorView) return;

    console.log('close completions', closeMode, immediately ? 'immediately' : 'delayed', this.currentCompletions);

    if (closeMode === 'accept' || closeMode === 'proceed' && typeof this.currentCompletions.selectedCompletion === 'number') {
      const chosen = this.currentCompletions.completions[
        this.currentCompletions.selectedCompletion || 0
      ];

      if (!chosen?.apply) return;

      if (typeof chosen.apply === 'function') {
        chosen.apply();
      } else if (typeof chosen.apply === 'string') {
        const codeBlockRegions = getCodeBlockRegionsOfEditorState(this.editorState);
        if (codeBlockRegions) {
          const block = codeBlockRegions.codeBlocks[this.currentCompletions.codeBlockIndex];
          if (block) {
            const rng = {
              from: block.script.pos + 1 + this.currentCompletions.scriptTargetStart,
              to: block.script.pos + 1 + this.currentCompletions.scriptTargetEnd,
              node: this.editorState.schema.text(chosen.apply)
            };

            if (immediately) {
              this.editorView.dispatch(
                this.editorState.tr.replaceRangeWith(rng.from, rng.to, rng.node));
            } else {
              const doc = this.editorState.doc;
              setTimeout(() => {
                if (this.editorView?.state.doc.eq(doc)) {
                  this.editorView.dispatch(
                    this.editorState.tr.replaceRangeWith(rng.from, rng.to, rng.node));
                }
              }, 1);
            }
          }
        }
      }
    }

    if (this.tooltipsHidden) {
      releaseHiddenTooltipForEditorState(this.editorState);
      this.tooltipsHidden = false;
    }

    this.decorations = undefined;
    this.currentCompletions = undefined;
  };

  highlightCompletionUp = () => {
    if (!this.currentCompletions) return;
    let nextSelect =
      typeof this.currentCompletions.selectedCompletion !== 'number' ? this.currentCompletions.completions.length - 1 :
        this.currentCompletions.selectedCompletion ? this.currentCompletions.selectedCompletion - 1 :
          this.currentCompletions.completions.length - 1;
    this.updateCompletionIndex(nextSelect);
  };

  highlightCompletionDown = () => {
    if (!this.currentCompletions) return;
    let nextSelect =
      typeof this.currentCompletions.selectedCompletion !== 'number' ? 0 :
        this.currentCompletions.selectedCompletion < this.currentCompletions.completions.length - 1 ? this.currentCompletions.selectedCompletion + 1 :
          0;
    this.updateCompletionIndex(nextSelect);
  };

  /**
   * @param {number} nextSelect
   */
  updateCompletionIndex = (nextSelect) => {
    if (!this.currentCompletions) return;
    if (this.currentCompletions.selectedCompletion === nextSelect) return;
    if (typeof this.currentCompletions.selectedCompletion === 'number') {
      this.currentCompletions.completions[this.currentCompletions.selectedCompletion].element.classList.remove(SELECTED_COMPLETION_MENU_ITEM_CLASS);
    }
    this.currentCompletions.selectedCompletion = nextSelect;
    const nextElement = this.currentCompletions.completions[this.currentCompletions.selectedCompletion].element;
    nextElement.classList.add(SELECTED_COMPLETION_MENU_ITEM_CLASS);
    if (this.currentCompletions.menuElement) {
      const parentBox = this.currentCompletions.menuElement.getBoundingClientRect();
      const nextBox = nextElement.getBoundingClientRect();
      const completelyVisible = nextBox.top >= parentBox.top && nextBox.bottom <= parentBox.bottom;
      if (!completelyVisible) {
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  /**
   * @param {CompletionProvider} completionProvider
   */
  addCompletionProvider = (completionProvider) => {
    this.completionProviders.push(completionProvider);

    if (this.editorView) this.editorView.dispatch(
      this.editorView.state.tr.setMeta('added completion provider', completionProvider));

    const self = this;

    return removeCompletionProvider;

    function removeCompletionProvider() {
      const index = self.completionProviders.indexOf(completionProvider);
      if (index >= 0) self.completionProviders.splice(index, 1);

      if (self.editorView) this.editorView.dispatch(
        self.editorView.state.tr.setMeta('removed completion provider', completionProvider));
    }
  };
}

const key = new PluginKey('COMPLETION_SERVICE');
/** @type {import('@milkdown/prose/state').Plugin<CodeCompletionService>} */
export const completionServicePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => new CodeCompletionService(config, editorState),
    apply: (tr, pluginState, oldEditorState, newEditorState) => {
      pluginState.apply(tr, oldEditorState, newEditorState);
      return pluginState;
    }
  },
  props: {
    decorations: (editorState) => {
      const pluginState = completionServicePlugin.getState(editorState);
      return pluginState?.decorations;
    },
    handleKeyDown: (view, event) => {
      const pluginState = completionServicePlugin.getState(view.state);
      return pluginState?.handleKeyDown(event);
    }
  },
  view: (editorView) => {
    const pluginState = completionServicePlugin.getState(editorView.state);
    if (pluginState) pluginState.editorView = editorView;

    return {};
  }
});

/**
 * @param {Transaction} tr
 */
export function insertedInTransaction(tr) {
  let insertedText = '';
  let insertedStart = 0;
  let insertedEnd = 0;
  let insertStepCount = 0;
  for (const step of tr.steps) {
    if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
      insertStepCount++;
      if (step.slice.content.childCount !== 1) return;
      const stepInsertedText = step.slice.content.firstChild?.textContent || '';
      if (stepInsertedText) {
        insertedText = stepInsertedText;
        insertedStart = step.from;
        insertedEnd = step.to;
      }
    }
  }

  return insertStepCount === 1 ? { text: insertedText, from: insertedStart, to: insertedEnd } : undefined;
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {CompletionProvider} completionProvider
 */
export function addCompletionProviderToEditorState(editorState, completionProvider) {
  const pluginState = completionServicePlugin.getState(editorState);
  return pluginState?.addCompletionProvider(completionProvider);
}

/**
 * @param {import('@milkdown/prose/view').EditorView} editorView
 * @param {CompletionProvider} completionProvider
 */
export function addCompletionProviderToEditorView(editorView, completionProvider) {
  return addCompletionProviderToEditorState(editorView.state, completionProvider);
}

