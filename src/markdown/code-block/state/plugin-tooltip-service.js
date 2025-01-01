// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';

import { getCodeBlockRegionsOfEditorState, getCodeBlockRegionsOfEditorView } from '../state-block-regions';

const IGNORE_TOOLTIP_DECORATION = 'ignore tooltip decoration change';

/**
 * @typedef {(args: {
 *  editorView: import('@milkdown/prose/view').EditorView,
 *  editorState: import('@milkdown/prose/state').EditorState,
 *  codeBlockIndex: number,
 *  codeBlockRegion: import('../state-block-regions/find-code-blocks').CodeBlockNodeset,
 *  documentPos: number,
 *  codeOffset: number
 * }) => TooltipContent | undefined} TooltipProvider
 */

/**
 * @typedef {{
 *  element: HTMLElement,
 *  highlightFrom: number,
 *  highlightTo: number
 * }} TooltipContent
 */

class CodeTooltipService {
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
     * @type {undefined | {
     *  pageX: number, pageY: number,
     *  codeBlockIndex: number,
     *  highlightFrom: number, highlightTo: number
     * }}
     */
    this.currentTooltip = undefined;

    /**
     * @type {HTMLElement | undefined}
     */
    this.tooltipElem = undefined;

    /**
     * @type {TooltipProvider[]}
     */
    this.tooltipProviders = [];

    this.hideTooltipCounter = 0;
  }

  /**
   * @param {import('@milkdown/prose/state').Transaction} tr
   * @param {import('@milkdown/prose/state').EditorState} oldEditorState
   * @param {import('@milkdown/prose/state').EditorState} newEditorState
   */
  apply = (tr, oldEditorState, newEditorState) => {
    this.editorState = newEditorState;
    if (!tr.getMeta(IGNORE_TOOLTIP_DECORATION))
      this.updateTooltip(undefined);
  };

  /**
   * @param {import('@milkdown/prose/view').EditorView} editorView
   */
  initView = (editorView) => {
    this.editorView = editorView;
    this.tooltipElem = document.createElement('div');
    this.tooltipElem.className = 'code-block-tooltip';
    this.tooltipElem.style.display = 'none';

    document.body.appendChild(this.tooltipElem);
    editorView.dom.addEventListener('mousedown', e => {
      this.updateTooltip(e, true);
    });
    editorView.dom.addEventListener('mousemove', e => {
      this.updateTooltip(e);
    });
    editorView.dom.addEventListener('keydown', e => {
      this.handleKeyDown(e);
    });
  };

  /**
 * @param {MouseEvent | undefined} withMouse
 * @param {boolean} [force]
 */
  updateTooltip = (withMouse, force) => {
    // this should never happen, update only comes when view is alread initialised
    if (!this.editorView || !this.tooltipElem) return;

    const codeBlockRegions = getCodeBlockRegionsOfEditorView(this.editorView);
    if (!codeBlockRegions) return;

    if (!withMouse) {
      if (!this.currentTooltip) return;
      // check if currentTooltip is still valid
      const currentTooltipGeoPos = this.editorView.posAtCoords({
        left: this.currentTooltip.pageX,
        top: this.currentTooltip.pageY
      });

      if (typeof currentTooltipGeoPos?.pos !== 'number') return;
      const currentTooltipDocumentPos =
        codeBlockRegions.codeBlocks[this.currentTooltip.codeBlockIndex]?.script.pos + 1 +
        this.currentTooltip.highlightFrom;
      if (currentTooltipGeoPos.pos >= currentTooltipDocumentPos &&
        currentTooltipGeoPos.pos < currentTooltipDocumentPos + this.currentTooltip.highlightTo - this.currentTooltip.highlightFrom) {
        return;
      }

      this.tooltipElem.style.display = 'none';
      this.tooltipElem.style.left = '0';
      this.tooltipElem.style.top = '0';
      this.currentTooltip = undefined;

      this.refreshTooltipDecorations('hide tooltip: not mouse');
    } else {
      const mouseGeoPos = this.editorView.posAtCoords({
        left: withMouse.pageX,
        top: withMouse.pageY
      });

      if (typeof mouseGeoPos?.pos !== 'number') {
        if (force && this.currentTooltip) {
          this.currentTooltip = undefined;
          this.tooltipElem.style.display = 'none';

          this.refreshTooltipDecorations('hide tooltip: with mouse pointing to nowhere');
        }
        return;
      }

      for (let iBlock = 0; iBlock < codeBlockRegions.codeBlocks.length; iBlock++) {
        const codeBlockRegion = codeBlockRegions.codeBlocks[iBlock];
        const scriptPos = codeBlockRegion.script.pos + 1;
        if (mouseGeoPos.pos < scriptPos || mouseGeoPos.pos > scriptPos + codeBlockRegion.script.node.nodeSize) continue;

        const scriptBlockPos = mouseGeoPos.pos - scriptPos;

        for (const provider of this.tooltipProviders) {
          const providerInfo = provider({
            editorView: this.editorView,
            editorState: this.editorView.state,
            codeBlockIndex: iBlock,
            codeBlockRegion,
            documentPos: mouseGeoPos.pos,
            codeOffset: scriptBlockPos
          });

          if (!providerInfo?.element) continue;

          const highlightFromCoords = this.editorView.coordsAtPos(
            scriptPos + providerInfo.highlightFrom);
          const highlightToCoords = this.editorView.coordsAtPos(
            scriptPos + providerInfo.highlightTo);

          const left = Math.min(highlightFromCoords.left, highlightToCoords.left);
          const bottom = Math.max(highlightFromCoords.bottom, highlightToCoords.bottom);

          const parentBox = (this.tooltipElem.offsetParent || this.tooltipElem.parentElement || document.body).getBoundingClientRect();
          this.tooltipElem.style.display = 'block';
          this.tooltipElem.style.transform =
            'translate(' +
            Math.max(0, left - parentBox.left - 20).toFixed() + 'px' +
            ',' +
            (bottom - parentBox.top + 64).toFixed() + 'px' +
            ')';
          this.tooltipElem.textContent = '';
          this.tooltipElem.appendChild(providerInfo.element);

          this.currentTooltip = {
            pageX: withMouse.pageX,
            pageY: withMouse.pageY,
            codeBlockIndex: iBlock,
            highlightFrom: providerInfo.highlightFrom,
            highlightTo: providerInfo.highlightTo
          };

          this.refreshTooltipDecorations('show tooltip ' + (withMouse ? 'with mouse' : 'not mouse'));
          return;
        }
      }

      if (force && this.currentTooltip) {
        this.currentTooltip = undefined;
        this.tooltipElem.style.display = 'none';

        this.refreshTooltipDecorations('hide tooltip: force but not tooltip created');
      }
    }
  };

  /**
   * @param {TooltipProvider} tooltipProvider
   */
  addTooltipProvider = (tooltipProvider) => {
    this.tooltipProviders.push(tooltipProvider);
    const self = this;

    this.updateTooltip(undefined);

    return removeTooltipProvider;

    function removeTooltipProvider() {
      const index = self.tooltipProviders.indexOf(tooltipProvider);
      if (index >= 0) self.tooltipProviders.splice(index, 1);
      self.updateTooltip(undefined);
    }
  };

  hideTooltipTemporarily = () => {
    this.hideTooltipCounter++;
    if (this.hideTooltipCounter === 1 && this.tooltipElem) {
      this.tooltipElem.style.visibility = 'hidden';
      this.refreshTooltipDecorations('hide tooltip temporarily');
    }
  };

  releaseHiddenTooltip = () => {
    this.hideTooltipCounter--;
    if (!this.hideTooltipCounter && this.tooltipElem) {
      this.tooltipElem.style.visibility = 'unset';
      this.refreshTooltipDecorations('release hidden tooltip');
    }
  };

  /**
   * @param {string} metaReason
   */
  refreshTooltipDecorations(metaReason) {
    this.editorView?.dispatch(
      this.editorView.state.tr
        .setMeta(IGNORE_TOOLTIP_DECORATION, true)
        .setMeta('refresh tooltip', metaReason));
  }

  /** @param {KeyboardEvent} event */
  handleKeyDown(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      if (this.tooltipElem) {
        this.tooltipElem.style.display = 'none';
        this.tooltipElem.style.left = '0';
        this.tooltipElem.style.top = '0';
        this.currentTooltip = undefined;

        this.refreshTooltipDecorations('hide tooltip: not mouse');
      }
    }
  }
}

const key = new PluginKey('TOOLTIP_SERVICE');
/** @type {import('@milkdown/prose/state').PluginSpec<CodeTooltipService>} */
export const tooltipServicePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => new CodeTooltipService(config, editorState),
    apply: (tr, pluginState, oldState, newState) => {
      pluginState.apply(tr, oldState, newState);
      return pluginState;
    },
  },
  props: {
    decorations: (editorState) => {
      const pluginState = tooltipServicePlugin.getState(editorState);
      if (pluginState?.currentTooltip) {
        const temporarilyHidden = pluginState.hideTooltipCounter;
        if (temporarilyHidden) return undefined;

        const codeBlockRegions = getCodeBlockRegionsOfEditorState(editorState);
        if (!codeBlockRegions) return undefined;
        const block = codeBlockRegions.codeBlocks[pluginState.currentTooltip.codeBlockIndex];
        if (!block) return undefined;

        return DecorationSet.create(editorState.doc, [
          Decoration.inline(
            block.script.pos + 1 + pluginState.currentTooltip.highlightFrom,
            block.script.pos + 1 + pluginState.currentTooltip.highlightTo,
            {
              class: 'code-block-tooltip-highlight'
            })
        ])
      }
    }
  },
  view: (editorView) => {
    const pluginState = tooltipServicePlugin.getState(editorView.state);
    pluginState?.initView(editorView);

    return {
    };
  }
});

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 * @param {TooltipProvider} tooltipProvider
 */
export function addTooltipProviderToEditorState(editorState, tooltipProvider) {
  const pluginState = tooltipServicePlugin.getState(editorState);
  return pluginState?.addTooltipProvider(tooltipProvider);
}

/**
 * @param {import('@milkdown/prose/view').EditorView} editorView
 * @param {TooltipProvider} tooltipProvider
 */
export function addTooltipProviderToEditorView(editorView, tooltipProvider) {
  return addTooltipProviderToEditorState(editorView.state, tooltipProvider);
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 */
export function hideTooltipTemporarilyForEditorState(editorState) {
  const pluginState = tooltipServicePlugin.getState(editorState);
  return pluginState?.hideTooltipTemporarily();
}

/**
 * @param {import('@milkdown/prose/state').EditorState} editorState
 */
export function releaseHiddenTooltipForEditorState(editorState) {
  const pluginState = tooltipServicePlugin.getState(editorState);
  return pluginState?.releaseHiddenTooltip();
}