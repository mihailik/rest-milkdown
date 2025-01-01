// @ts-check

import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';

import { getSelectionModifiersForDocument } from './unicode-formatting/get-selection-modifiers';
import { getCodeBlockRegionsOfEditorState } from './code-block/state-block-regions';
import { applyUnicodeModifiers } from './unicode-formatting/apply-unicode-modifiers';
import { applyModifier } from '../unicode-formatting/apply-modifier';

export const FORMATTING_BUTTONS_PRESS_SERIES_TIMEOUT = 2400;

const key = new PluginKey('FORMATTING_BUTTONS');
/** @type {import('@milkdown/prose/state').PluginSpec} */
export const formattingButtonsPlugin = new Plugin({
  key,
  view: (editorView) => {
    const {
      boldItalicToggle,
      headingToggle,
      codeInsert,
      dividerInsert,
      unicodeFormatToggle,
      unicodeSubsection,
      uniBoldItalicToggle,
      uniUnderlineToggle,
      uniJoyToggle,
      uniWtfToggle,
      uniCursiveSuperToggle,
      uniRpxToggle,
      uniKhazadToggle
    } = Array.from(
      /** @type {NodeListOf<HTMLElement>} */
      (document.getElementById('format-tools')?.querySelectorAll('button, span') || []))
      .reduce((acc, button) => {
        const id = button.id;
        if (!id) return acc;
        const idCanonicalized = id.replace(/\-[a-z]/, (dashLetter) => dashLetter.charAt(1).toUpperCase());
        acc[idCanonicalized] = button;
        return acc;
      }, /** @type {Record<string, HTMLElement>} */({}));
    
    if (boldItalicToggle) boldItalicToggle.onmousedown = handleBoldItalicClick;
    if (headingToggle) headingToggle.onmousedown = handleHeadingClick;
    if (codeInsert) codeInsert.onmousedown = handleCodeInsert;
    if (dividerInsert) dividerInsert.onmousedown = handleDividerInsert;
    if (unicodeFormatToggle) unicodeFormatToggle.onmousedown = handleUnicodeFormatToggle;
    if (uniBoldItalicToggle) uniBoldItalicToggle.onmousedown = handleUnicodeBoldItalicClick;
    if (uniUnderlineToggle) uniUnderlineToggle.onmousedown = handleUnicodeUnderlineToggle;
    if (uniJoyToggle) uniJoyToggle.onmousedown = handleUnicodeJoyToggle;
    if (uniWtfToggle) uniWtfToggle.onmousedown = handleUnicodeWtfToggle;
    if (uniCursiveSuperToggle) uniCursiveSuperToggle.onmousedown = handleUnicodeCursiveSuperToggle;
    if (uniRpxToggle) uniRpxToggle.onmousedown = handleUnicodeRpxToggle;
    if (uniKhazadToggle) uniKhazadToggle.onmousedown = handleUnicodeKhazadToggle;


    return {
      update: (view, prevState) => {
        updateButtons(view, prevState);
      }
    };

    /** @type {undefined | { action: string, time: number, [other: string]: any }} */
    var latestPress;

    /**
     * @param {import('@milkdown/prose/view').EditorView} view
     * @param {import('@milkdown/prose/state').EditorState} prevState
     */
    function updateButtons(view, prevState) {

      const selMods = getSelectionModifiersForDocument(editorView.state);
      const currentUniBoldItalic =
        selMods.modifiers.indexOf('bold') >= 0 ? (
          selMods.modifiers.indexOf('italic') >= 0 ? 'bold-italic' : 'bold'
        ) : (
          selMods.modifiers.indexOf('italic') >= 0 ? 'italic' : ''
        );
      if (uniBoldItalicToggle) uniBoldItalicToggle.className = currentUniBoldItalic;

      const currentUniUnderline = selMods.modifiers.indexOf('underline') >= 0 ? 'underline' : '';
      if (uniUnderlineToggle) uniUnderlineToggle.className = currentUniUnderline;

      const currentUniJoy = selMods.modifiers.indexOf('joy') >= 0 ? 'joy' : '';
      if (uniJoyToggle) uniJoyToggle.className = currentUniJoy;

      const currentUniWtf = [
        selMods.modifiers.indexOf('wide') >= 0 ? 'wide' : '',
        selMods.modifiers.indexOf('typewriter') >= 0 ? 'typewriter' : '',
        selMods.modifiers.indexOf('fractur') >= 0 ? 'fractur' : ''].filter(Boolean).join('-');
      if (uniWtfToggle) uniWtfToggle.className = currentUniWtf;

      const currentUniCursiveSuper = [
        selMods.modifiers.indexOf('cursive') >= 0 ? 'cursive' : '',
        selMods.modifiers.indexOf('super') >= 0 ? 'super' : ''].filter(Boolean).join('-');
      if (uniCursiveSuperToggle) uniCursiveSuperToggle.className = currentUniCursiveSuper;

      const currentUniRpx = [
        selMods.modifiers.indexOf('round') >= 0 ? 'round' : '',
        selMods.modifiers.indexOf('plate') >= 0 ? 'plate' : '',
        selMods.modifiers.indexOf('box') >= 0 ? 'box' : ''].filter(Boolean).join('-');
      if (uniRpxToggle) uniRpxToggle.className = currentUniRpx;

      const currentUniKhazad = selMods.modifiers.indexOf('khazad') >= 0 ? 'khazad' : '';
      if (uniKhazadToggle) uniKhazadToggle.className = currentUniKhazad;

      const boldItalicCurrent = getBoldItalic();
      if (boldItalicToggle) boldItalicToggle.className = boldItalicCurrent.className;

      const headingCurrent = getHeading();
      if (headingToggle) headingToggle.className = headingCurrent ? `h${headingCurrent}` : '';
    }

    function getBoldItalic() {
      let hasBold = editorView.state.doc.rangeHasMark(
        editorView.state.selection.from,
        editorView.state.selection.to,
        editorView.state.schema.marks.strong);
      let hasItalic = editorView.state.doc.rangeHasMark(
        editorView.state.selection.from,
        editorView.state.selection.to,
        editorView.state.schema.marks.emphasis);

      editorView.state.doc.nodesBetween(
        editorView.state.selection.from,
        editorView.state.selection.to,
        (node, pos) => {
          if (node.marks) {
            for (let m of node.marks) {
              if (m.type.name === 'strong') hasBold = true;
              if (m.type.name === 'emphasis') hasItalic = true;
            }
          }
        });

      return { bold: hasBold, italic: hasItalic, className: hasBold ? (hasItalic ? 'bold-italic' : 'bold') : (hasItalic ? 'italic' : '') };
    }

    function getHeading() {
      /** @type {number | undefined} */
      let headingLevel;
      editorView.state.doc.nodesBetween(
        editorView.state.selection.from,
        editorView.state.selection.to,
        (node, pos) => {
          if (node.type.name === 'heading') {
            if (typeof headingLevel === 'undefined' || headingLevel < node.attrs.level) {
              headingLevel = node.attrs.level;
            }
          }
        });
      
      return headingLevel;
    }

    function selectionWithinCodeBlock() {
      const { from, to } = editorView.state.selection;
      /** @type {{ node: import('@milkdown/prose/model').Node, pos: number } | undefined} */
      let withinCodeBlock;
      editorView.state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === 'code_block') {
          withinCodeBlock = { node, pos };
        }
      });
      return withinCodeBlock;
    }

    /** @type {HTMLElement} */
    var flyElemLast;

    var flyDebounceTimeout;

    /**
     * @param {{ from: number, to: number }} span
     * @param {string | undefined} label
     * @param {HTMLElement} fromElement
     */
    function flyFormattingAnimation(span, label, fromElement) {
      if (!label || label === 'none') return;

      console.log('fly ', label, 'to ', span);

      clearTimeout(flyDebounceTimeout);
      flyDebounceTimeout = setTimeout(() => {

        const fromCoords = editorView.coordsAtPos(span.from, -1);
        const toCoords = editorView.coordsAtPos(span.to, +1);

        const bottomEdge = Math.min(fromCoords.bottom, toCoords.bottom);
        const leftEdge = Math.min(fromCoords.left, toCoords.left);
        const rightEdge = Math.max(fromCoords.right, toCoords.right);

        const fromElemBounds = fromElement.getBoundingClientRect();

        if (flyElemLast) flyElemLast.remove();

        const flyElem = flyElemLast = document.createElement('div');
        flyElem.className = 'fly-formatting';
        flyElem.style.cssText =
          'position: fixed; pointer-events: none; z-index: 1000; text-align: center; ' +
          'font-size: 150%; ' +
          'filter: blur(5px); transition: all 100ms;';
        flyElem.textContent = label;
        flyElem.style.left = leftEdge + 'px';
        flyElem.style.top = (bottomEdge + 10) + 'px';
        flyElem.style.width = (rightEdge - leftEdge) + 'px';

        flyElem.style.transform =
          'translate(' + (fromElemBounds.left - leftEdge) + 'px, ' +
          (fromElemBounds.top - bottomEdge) + 'px) scale(0.1)';
      
        document.body.appendChild(flyElem);
        setTimeout(() => {
          if (flyElem !== flyElemLast) return;
          flyElem.style.transform = 'none';
          flyElem.style.filter = '';

          setTimeout(() => {
            if (flyElem !== flyElemLast) return;
            flyElem.style.opacity = '0';
            flyElem.style.filter = 'blur(10px)';
            setTimeout(() => {
              if (flyElem !== flyElemLast) return;
              flyElem.remove();
              flyElemLast = /** @type {*} */(undefined);
            }, 300);

          }, 1000);
        }, 10);
      }, 20);
    }

    /** @param {MouseEvent} e */
    function handleBoldItalicClick(e) {
      e.preventDefault();
      e.stopPropagation();

      if (selectionWithinCodeBlock()) return;

      const boldItalic = getBoldItalic();
      const now = Date.now();

      if (latestPress?.action === 'bold-italic' && now - latestPress.time < FORMATTING_BUTTONS_PRESS_SERIES_TIMEOUT) {
        editorView.dispatch(editorView.state.tr.setMeta('bold-italic', false));

        const newSet =
          latestPress.set === 'bold' ? 'italic' :
            latestPress.set === 'italic' ? 'bold-italic' :
              latestPress.set === 'bold-italic' ? 'none' : 'bold';

        const tr = editorView.state.tr;
        if (newSet === 'bold' || newSet === 'bold-italic') tr.addMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.strong.create());
        else tr.removeMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.strong);

        if (newSet === 'italic' || newSet === 'bold-italic') tr.addMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.emphasis.create());
        else tr.removeMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.emphasis);

        flyFormattingAnimation(editorView.state.selection, newSet, boldItalicToggle);

        editorView.dispatch(tr);

        latestPress = { action: 'bold-italic', time: now, set: newSet };
      } else {
        if (boldItalic.bold || boldItalic.italic) {
          editorView.dispatch(
            editorView.state.tr
              .removeMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.strong)
              .removeMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.italic)
          );
          latestPress = { action: 'bold-italic', time: now, set: 'none' };
        } else {
          flyFormattingAnimation(editorView.state.selection, 'bold', boldItalicToggle);

          editorView.dispatch(
            editorView.state.tr
              .addMark(editorView.state.selection.from, editorView.state.selection.to, editorView.state.schema.marks.strong.create())
          );
          latestPress = { action: 'bold-italic', time: now, set: 'bold' };
        }
      }
    }

    /** @param {MouseEvent} e */
    function handleHeadingClick(e) {
      e.preventDefault();
      e.stopPropagation();

      if (selectionWithinCodeBlock()) return;

      const headingLevel = getHeading();
      const now = Date.now();

      let newLevel = headingLevel ? 0 : 1;
      if (latestPress?.action === 'heading' && now - latestPress.time < FORMATTING_BUTTONS_PRESS_SERIES_TIMEOUT) {
        newLevel = headingLevel === 6 ? 0 : (headingLevel || 0) + 1;
      }

      /** @type {{ node: import('@milkdown/prose/model').Node, pos: number } | undefined} */
      let nodeToChange;
      editorView.state.doc.nodesBetween(
        editorView.state.selection.from,
        editorView.state.selection.to,
        (node, pos) => {
          if (node.type.name === 'heading' || node.type.name === 'paragraph') {
            if (!nodeToChange)
              nodeToChange = { node, pos };
          }
        });
      
      if (!nodeToChange) return;

      if (newLevel) {
        editorView.dispatch(
          editorView.state.tr.setNodeMarkup(
            nodeToChange.pos,
            editorView.state.schema.nodes.heading, { level: newLevel })
        );
      } else {
        if (headingLevel) {
          editorView.dispatch(
            editorView.state.tr.setNodeMarkup(
              nodeToChange.pos,
              editorView.state.schema.nodes.paragraph)
          );
        }
      }

      latestPress = { action: 'heading', time: now, level: newLevel };

    }

    /** @param {MouseEvent} e */
    function handleCodeInsert(e) {
      e.preventDefault();
      e.stopPropagation();

      const codeBlockNode = selectionWithinCodeBlock();
      if (codeBlockNode) {
        const regions = getCodeBlockRegionsOfEditorState(editorView.state);
        const selectedRegion = regions?.codeBlocks.find(block => codeBlockNode.pos >= block.block.pos && codeBlockNode.pos < block.block.pos + block.block.node.nodeSize);
        if (!selectedRegion) return;

        let tr = editorView.state.tr;
        tr = tr.delete(selectedRegion.block.pos, selectedRegion.block.node.nodeSize);
        if (selectedRegion.code) {
          tr = tr.insert(
            selectedRegion.block.pos,
            editorView.state.schema.node(
              'paragraph',
              null,
              editorView.state.schema.text(selectedRegion.code)));
        }

        editorView.dispatch(tr);
      } else {
        let tr = editorView.state.tr;
        tr.split(editorView.state.selection.anchor);
        tr = tr.insert(
          editorView.state.selection.anchor,
          editorView.state.schema.node(
            'code_block',
            null,
            [
              editorView.state.schema.node('code_block_backtick_language'),
              editorView.state.schema.node('code_block_script'),
              editorView.state.schema.node('code_block_execution_state'),
            ]));
        tr.setSelection(TextSelection.create(tr.doc, editorView.state.selection.anchor + 1));
        editorView.dispatch(tr);
      }
    }

    /** @param {MouseEvent} e */
    function handleDividerInsert(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    /** @param {MouseEvent} e */
    function handleUnicodeFormatToggle(e) {
      e.preventDefault();
      e.stopPropagation();

      if (unicodeSubsection?.classList.contains('slide')) unicodeSubsection.classList.remove('slide');
      else unicodeSubsection?.classList.add('slide');
    }

    /**
     * @param {MouseEvent} e
     * @param {string[]} cycle
     */
    function handleUnicodeCycle(e, cycle) {
      e.preventDefault();
      e.stopPropagation();

      const selMod = getSelectionModifiersForDocument(editorView.state, {
        from: editorView.state.selection.anchor,
        to: editorView.state.selection.head,
        expandToText: true
      });

      const now = Date.now();
      const action = cycle.join(':');

      let applyMod;
      let exclusive = false;
      if (latestPress?.action === action && now - latestPress.time < FORMATTING_BUTTONS_PRESS_SERIES_TIMEOUT) {
        // iterate cycle[0] -> cycle[1] -> ... -> none
        applyMod = cycle[cycle.indexOf(latestPress.modifier) + 1] || '';
        exclusive = true;
      } else {
        if (selMod.modifiers.some(m => cycle.indexOf(m) >= 0)) {
          applyMod = undefined;
        } else {
          applyMod = cycle[0];
        }
      }

      const applySpan = { from: 0, to: 0 };

      const apply = applyUnicodeModifiers(
        editorView.state,
        () => {
          const result =
            applyMod === 'bolditalic' ? {
              add: ['bold', 'italic'],
              remove: []
            } :
              {
                add: applyMod ? [applyMod] : [],
                remove:
                  !applyMod ? cycle :
                    exclusive ? cycle.filter(mod => mod !== applyMod) :
                      []
              };
          return result;
        },
        {
          from: editorView.state.selection.anchor,
          to: editorView.state.selection.head,
          expandToText: true
        },
        applySpan
      );

      if (apply) {
        editorView.dispatch(apply);

        editorView.focus();
        editorView.updateRoot();
        editorView.focus();

        if (applyMod) {
          let applyModifierLabel = applyMod === 'bolditalic' ? 'bold-italic' : applyMod;
          applyModifierLabel = applyMod.charAt(0).toUpperCase() + applyMod.slice(1);
          applyModifierLabel = applyModifier(applyModifierLabel, applyMod);

          flyFormattingAnimation(
            applySpan,
            applyModifierLabel,
          /** @type {HTMLElement} */(e.target));
        }
      }

      latestPress = { action, time: now, modifier: applyMod };
      // unicodeSubsection.classList.remove('slide');
    }

    /**
     * @param {MouseEvent} e
     * @param {string} modifier
     */
    function handleUnicodeToggle(e, modifier) {
      e.preventDefault();
      e.stopPropagation();

      const applySpan = { from: 0, to: 0 };

      const apply = applyUnicodeModifiers(
        editorView.state,
        modifier,
        {
          from: editorView.state.selection.anchor,
          to: editorView.state.selection.head,
          expandToText: true
        },
        applySpan);

      if (apply) {
        editorView.dispatch(apply);

        editorView.focus();
        editorView.updateRoot();
        editorView.focus();

        let modifierLabel = modifier.charAt(0).toUpperCase() + modifier.slice(1);
        modifierLabel = applyModifier(modifierLabel, modifier);

        flyFormattingAnimation(
          applySpan,
          modifierLabel,
          /** @type {HTMLElement} */(e.target));
      }

      // const selMod = getSelectionModifiersForDocument(editorView.state, {
      //   from: editorView.state.selection.anchor,
      //   to: editorView.state.selection.head,
      //   expandToText: true
      // });

      const now = Date.now();

      // if (selMod.modifiers.some(m => m === modifier)) {
      //   // clear modifier
      // } else {
      //   // set modifier
      // }

      latestPress = { action: modifier, time: now };
      // unicodeSubsection.classList.remove('slide');
    }

    /** @param {MouseEvent} e */
    function handleUnicodeBoldItalicClick(e) {
      handleUnicodeCycle(e, ['bold', 'italic', 'bolditalic']);
    }

    /** @param {MouseEvent} e */
    function handleUnicodeUnderlineToggle(e) {
      handleUnicodeToggle(e, 'underline');
    }

    /** @param {MouseEvent} e */
    function handleUnicodeJoyToggle(e) {
      handleUnicodeToggle(e, 'joy');
    }

    /** @param {MouseEvent} e */
    function handleUnicodeWtfToggle(e) {
      handleUnicodeCycle(e, ['wide', 'typewriter', 'fractur']);
    }

    /** @param {MouseEvent} e */
    function handleUnicodeCursiveSuperToggle(e) {
      handleUnicodeCycle(e, ['cursive', 'super']);
    }

    /** @param {MouseEvent} e */
    function handleUnicodeRpxToggle(e) {
      handleUnicodeCycle(e, ['round', 'plate', 'box']);
    }

    /** @param {MouseEvent} e */
    function handleUnicodeKhazadToggle(e) {
      handleUnicodeToggle(e, 'khazad');
    }


  }
});