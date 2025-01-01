// @ts-check

import { parseDate } from '../table/parse-date';

/**
 * @param {import('.').ValueRenderParams<number | bigint>} params
 */
export function renderNumber({ value, wrap }) {
  wrap.availableHeight = Math.max(0, wrap.availableHeight - 1);

  if (Number.isNaN(value)) return { class: 'hi-number hi-nan', textContent: 'NaN' };
  if (!Number.isFinite(value)) return { class: 'hi-number hi-infinity', textContent: String(value) };

  const str = String(value);
  const posE = str.indexOf('e');
  const posDot = str.indexOf('.');

  if (posE >= 0) return { class: 'hi-number', textContent: str };
  if (posDot >= 0) return { class: 'hi-number', textContent: str };

  const dt = typeof value !== 'number' ? undefined : parseDate(value);
  if (dt) {
    return [
      { class: 'hi-number', textContent: value.toString() },
      {
        widget: () => {
          const span = document.createElement('span');
          span.className = 'hi-comment hi-date-tip';
          const now = new Date();
          span.textContent = ' /*' + dt.toISOString() + '*/';
          if (dt.getFullYear() === now.getFullYear() &&
            dt.getMonth() === now.getMonth() &&
            dt.getDate() === now.getDate())
            span.textContent = ' /*' + span.textContent.split('T')[1];
          return span;
        }
      }
    ];
  }

  if (str.length < 3) return { class: 'hi-number', textContent: value.toString() };

  const output = [];
  for (let i = 0; i < str.length; i += 3) {
    const chunkStr = str.slice(Math.max(0, str.length - i - 3), str.length - i);
    if (chunkStr === '-' || !output.length) output.unshift({ class: 'hi-number', textContent: chunkStr });
    else output.unshift({ class: 'hi-number hi-number-padded-group', textContent: chunkStr });
  }

  return output;
}

/**
 * @param {import('.').ValueRenderParams<boolean>} params
 */
export function renderBoolean({ value, wrap }) {
  wrap.availableHeight = Math.max(0, wrap.availableHeight - 1);
  return { class: 'hi-boolean', textContent: value.toString() };
}

/**
 * @param {import('.').ValueRenderParams<Symbol>} params
 */
export function renderSymbol({ value, wrap }) {
  wrap.availableHeight = Math.max(0, wrap.availableHeight - 1);
  return { class: 'hi-symbol', textContent: 'Symbol(' + (value.description || '') + ')' };
}
