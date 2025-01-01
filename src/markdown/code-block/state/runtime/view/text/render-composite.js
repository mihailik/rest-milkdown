// @ts-check

import { renderValue } from '.';
import { DEFAULT_DESIRABLE_EXPAND_HEIGHT } from '../render-succeeded';
import { renderPropName } from './render-prop-name';

export const EXPAND_HEIGHT_STEP = 400;

export const MAX_PRIMITIVE_STRING = 50;

export const MAX_SINGLE_LINE_PRIMITIVE_ARRAY_COUNT = 15;
export const MAX_SINGLE_LINE_PRIMITIVE_OBJECT_COUNT = 10;

/**
 * Firstly, check if this composite is single-line or multi-line.
 * Single-line contains only primitive values and Date instances, strings are short.
 * Single-line that's too long is not allowed.
 * 
 * Multi-line composites will be either:
 *  a) fully collapsed, and displayed as single line with abbreviated content
 *  b) partially expanded, the expansion size is preserved in state
 *  c) fully expanded
 *
 * If state contains a selection for expand-collapse state, use that.
 * State uses a single variable `expandTo` to store the number of entries to expand to.
 * When `expandTo` is 0, the composite is collapsed.
 *
 * If the budget availableSize is 1 or below, the composite is collapsed.
 *
 * If the number of entries is within the budget availableSize, the composite is fully expanded.
 *
 * Otherwise, we have a partial expanded state. Render the first `expandTo` entries, and expansion markers.
 *
 * @param {import('.').ValueRenderParams<any[] | Record<string, any>>} params
 */
export function renderComposite(params) {
  const { value, path, wrap, invalidate, state } = params;

  const isArray = Array.isArray(value);

  const props = Object.getOwnPropertyNames(value);
  const values = [];
  let primitiveValueCount = 0;
  for (let i = 0; i < props.length; i++) {
    const k = props[i];

    // hide length property for an array
    if (k === 'length' && isArray) {
      props.splice(i, 1);
      i--;
      continue;
    }

    try {
      const item = value[k];
      values.push(item);

      const pri = isPrimitiveValue(item);
      if (pri) primitiveValueCount++;
    } catch (err) {
      values.push();
    }
  }

  /** @type {number | undefined} */
  const stateExpandTo = state[path + '.expandTo'];

  const MAX_SINGLE_LINE_PRIMITIVE_ENTRY_COUNT = isArray ?
    MAX_SINGLE_LINE_PRIMITIVE_ARRAY_COUNT : MAX_SINGLE_LINE_PRIMITIVE_OBJECT_COUNT;

  if (typeof stateExpandTo === 'number' && stateExpandTo <= 2 ||
    wrap.availableHeight <= 2 ||
    (primitiveValueCount === values.length && primitiveValueCount < MAX_SINGLE_LINE_PRIMITIVE_ENTRY_COUNT)) {
    return renderSingleLine(params, isArray, props, values);
  } else {
    return renderMultiline(params, isArray, props, values);
  }
}

/**
 * @param {import('.').ValueRenderParams<any[] | Record<string, any>>} params
 * @param {boolean} isArray
 * @param {string[]} props
 * @param {any[]} values
 */
function renderMultiline(params, isArray, props, values) {
  const { value, path, indent: originialIndent, wrap, invalidate, state } = params;
  const indent = originialIndent + '  ';

  /** @type {number | undefined} */
  const stateExpandTo = state[path + '.expandTo'];
  let expandTo = stateExpandTo ?? wrap.availableHeight;

  let spentHeight = 2; // brackets themselves

  const openingBracket = isArray ? { class: 'hi-obj-array json-collapse-hint hi-punctuation', textContent: '[' } :
    { class: 'hi-obj json-collapse-hint hi-punctuation', textContent: '{' };

  /** @type {import('..').RenderedContent[]} */
  let output = [];
  output.push(openingBracket);

  output.push({
    widget: () => {
      const collapseButton = document.createElement('button');
      collapseButton.className = 'json-toggle-collapse';
      collapseButton.onclick = () => {
        state[path + '.expandTo'] = 0;
        invalidate();
      };
      return collapseButton;
    }
  });

  const innerWrap = { availableHeight: expandTo };
  let overflowProps = 0;
  /** @type {number | undefined} */
  let lastIndex = -1;
  for (let iProp = 0; iProp < props.length; iProp++) {
    const allocateInnerHeight = expandTo - spentHeight;
    if (allocateInnerHeight <= 0) {
      overflowProps = props.length - iProp;
      break;
    }

    const k = props[iProp];
    const v = values[iProp];

    const kIndex = Number(k);
    const isKIndex = isArray && !Number.isNaN(k);

    if (iProp) output.push({ class: 'hi-obj-array hi-punctuation', textContent: ',\n' + indent });
    else output.push('\n' + indent);
    if (isArray && isKIndex && typeof lastIndex === 'number' && kIndex === lastIndex + 1) {
      lastIndex = kIndex;
    } else {
      const propName = renderPropName(k);
      output.push(...propName);
      lastIndex = undefined;
    }

    const itemPath = isKIndex ? path + '[' + k + ']' : path + '.' + k;
    innerWrap.availableHeight = allocateInnerHeight;

    let itemOutput =
      v === value ? { class: 'hi-undefined', textContent: 'self' } :
        (k === 'parent' || k === 'top' || k === '0') && v instanceof Window ? { class: 'hi-undefined', textContent: k === '0' ? 'window' : k } :
          renderValue({
            value: v,
            path: itemPath,
            indent,
            wrap: innerWrap,
            invalidate,
            state
          });

    if (Array.isArray(itemOutput)) {
      output = output.concat(itemOutput);
    } else {
      output.push(itemOutput);
    }

    spentHeight += (allocateInnerHeight - innerWrap.availableHeight);
  }

  if (overflowProps) {
    output.push(
      { class: 'hi-obj hi-punctuation', textContent: ',\n' + indent },
      {
        widget: () => {
          const expandButton = document.createElement('button');
          expandButton.className = 'json-toggle-expand';
          expandButton.textContent = '...' + overflowProps.toLocaleString() + ' more';
          expandButton.onclick = () => {
            const currentExpandToRounded = Math.ceil(expandTo / DEFAULT_DESIRABLE_EXPAND_HEIGHT)
              * DEFAULT_DESIRABLE_EXPAND_HEIGHT;

            state[path + '.expandTo'] = currentExpandToRounded + EXPAND_HEIGHT_STEP;

            invalidate();
          };
          return expandButton;
        }
      });
  }

  output.push('\n' + originialIndent);

  const closingBracket = isArray ? { class: 'hi-obj-array hi-punctuation', textContent: ']' } :
    { class: 'hi-obj hi-punctuation', textContent: '}' };

  output.push(closingBracket);

  wrap.availableHeight -= spentHeight;

  return output;
}

/**
 * @param {import('.').ValueRenderParams<any[] | Record<string, any>>} params
 * @param {boolean} isArray
 * @param {string[]} props
 * @param {any[]} values
 */
function renderSingleLine(params, isArray, props, values) {
  const { value, path, indent: originialIndent, wrap, state, invalidate } = params;
  const indent = originialIndent + '  ';

  const openingBracket =
    isArray ? { class: 'hi-obj-array hi-punctuation', textContent: '[' } :
      { class: 'hi-obj hi-punctuation', textContent: '{' };

  /** @type {import('..').RenderedContent[]} */
  let output = [];
  output.push(openingBracket);

  let overflowProps = 0;

  /** @type {number | undefined} */
  let lastIndex = -1;
  const innerWrap = { availableHeight: 1 };
  const MAX_SINGLE_LINE_PRIMITIVE_ENTRY_COUNT = isArray ?
    MAX_SINGLE_LINE_PRIMITIVE_ARRAY_COUNT : MAX_SINGLE_LINE_PRIMITIVE_OBJECT_COUNT;

  for (let iProp = 0; iProp < props.length; iProp++) {
    if (iProp > MAX_SINGLE_LINE_PRIMITIVE_ENTRY_COUNT) {
      overflowProps = props.length - iProp;
      break;
    }

    if (iProp) output.push({ class: 'hi-obj-array hi-punctuation', textContent: ', ' });

    const k = props[iProp];
    const v = values[iProp];

    const kIndex = Number(k);
    const isKIndex = isArray && !Number.isNaN(k);

    if (isArray && isKIndex && typeof lastIndex === 'number' && kIndex === lastIndex + 1) {
      lastIndex = kIndex;
    } else {
      const propName = renderPropName(k);
      output.push(...propName);
      lastIndex = undefined;
    }


    if (isPrimitiveValue(v)) {
      // render value inline
      const itemPath = isArray ? path + '[' + k + ']' : path + '.' + k;
      let itemOutput = renderValue({
        value: v,
        path: itemPath,
        indent,
        wrap: innerWrap,
        invalidate,
        state
      });

      if (Array.isArray(itemOutput)) {
        output = output.concat(itemOutput);
      } else {
        output.push(itemOutput);
      }
    } else {
      if (Array.isArray(v))  output.push({ class: 'hi-obj-array hi-punctuation', textContent: '[' });
      else output.push({ class: 'hi-obj-array hi-punctuation', textContent: '{' });

      output.push({
        widget: () => {
          const expandButton = document.createElement('button');
          expandButton.className = 'json-toggle-expand';
          expandButton.textContent = '...';
          expandButton.onclick = () => {
            state[path + '.expandTo'] = EXPAND_HEIGHT_STEP;
            invalidate();
          };
          return expandButton;
        }
      });

      if (Array.isArray(v)) output.push({ class: 'hi-obj-array hi-punctuation', textContent: ']' });
      else output.push({ class: 'hi-obj-array hi-punctuation', textContent: '}' });

    }
  }

  if (overflowProps) {
    output.push({
      widget: () => {
        const expandButton = document.createElement('button');
        expandButton.className = 'json-toggle-expand';
        expandButton.textContent = ', ...';
        expandButton.onclick = () => {
          state[path + '.expandTo'] = EXPAND_HEIGHT_STEP;
          invalidate();
        };
        return expandButton;
      }
    });
  }

  const closingBracket = isArray ? { class: 'hi-obj-array hi-punctuation', textContent: ']' } :
    { class: 'hi-obj hi-punctuation', textContent: '}' };
  
  wrap.availableHeight--;

  output.push(closingBracket);

  return output;
}

function isPrimitiveValue(value) {
  // special case for document.all
  if (!value && typeof value === 'undefined' && value !== undefined) return false;

  if (typeof value === 'string') return value.length < MAX_PRIMITIVE_STRING;
  return !value || (typeof value !== 'object') || (value instanceof Date);
}