// @ts-check

import { parseDate } from './parse-date';

const dtCache = new Date();

/**
 * @param {import('ag-grid-community').ICellRendererParams} props
 */
export function dateCellRenderer(props) {
  /** @type {{min: number, max: number, count: number } | undefined} */
  const stats = props.colDef?.cellRendererParams?.col?.types?.date;

  const dt = parseDate(props.value);

  if (!dt) return props.value;

  const container = document.createElement('div');
  container.className = 'cell-date';
  container.title =
    dt.toLocaleDateString() + ' \n' +
    dt.toLocaleTimeString() + '\n\n' + 
    dt.toISOString();

  const now = Date.now();
  const dtTime = dt.getTime();

  let diff = Math.abs(now - dtTime);

  const direction = dtTime > now ? 'future' : 'past';
  container.classList.add(direction);

  let far = false;
  if (diff > 1000 * 60 * 60 * 24 * 7) {
    container.classList.add('far-' + direction);
    far = true;
  } else if (diff > 1000 * 60 * 60 * 24) {
    container.classList.add('near-' + direction);
  } else {
    container.classList.add(direction === 'future' ? 'soon' : 'recent');
  }

  if (far) {
    container.textContent = dt.toLocaleDateString();
  } else {
    dtCache.setTime(now);
    const d = dt.toLocaleDateString();
    if (d === dtCache.toLocaleDateString()) {
      container.textContent = dt.toLocaleTimeString();
    }
    else {
      container.textContent = d + ' ' + dt.toLocaleTimeString();
    }
  }

  return container;
}