// @ts-check

import { parseDate } from './parse-date';

/**
 * @param {NonNullable<ReturnType<import('./collect-columns').collectColumns>>} columns
 * @param {any} result
 */
export function createHtmlTable(columns, result) {
  const tableContainer = document.createElement('div');
  tableContainer.style.cssText = 'height: 30em; overflow: auto; width: 100%;';

  const table = document.createElement('table');
  table.className = 'results-html-table';
  tableContainer.appendChild(table);
  const thead = document.createElement('thead');
  table.appendChild(thead);
  const headRows = [document.createElement('tr')];
  thead.appendChild(headRows[0]);

  for (const colDesc of columns) {
    addColumnHeading(colDesc, 0);
  }

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  let index = 0;
  for (const entry of result) {
    index++;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const tr = document.createElement('tr');
    tbody.appendChild(tr);

    for (const colDesc of columns) {
      addColumnForRow(colDesc, entry, tr);
    }
  }

  return tableContainer;

  /**
   * @param {import('./collect-columns').ColumnSpec} colSpec
   * @param {number} depth
   */
  function addColumnHeading(colSpec, depth) {
    const th = document.createElement('th');
    th.textContent = colSpec.key;
    if (!headRows[depth]) {
      headRows[depth] = document.createElement('tr');
      thead.appendChild(headRows[depth]);
    }
    headRows[depth].appendChild(th);
    if (!colSpec.subColumns) {
      th.rowSpan = columns.maxDepth - depth;
      return;
    }

    th.colSpan = colSpec.subColumns.totalWidth;
    for (const subCol of colSpec.subColumns) {
      addColumnHeading(subCol, depth + 1);
    }
  }

  /**
   * @param {import('./collect-columns').ColumnSpec} colSpec
   * @param {any} rowObj
   * @param {HTMLTableRowElement} tr
   */
  function addColumnForRow(colSpec, rowObj, tr) {
    const cellObj = colSpec.getter(rowObj);
    if (colSpec.subColumns) {
      for (const subCol of colSpec.subColumns) {
        addColumnForRow(subCol, cellObj, tr);
      }
    } else {
      const td = document.createElement('td');
      let data = colSpec.getter(rowObj);
      if (colSpec.bestType === 'date') {
        const parsed = parseDate(data);
        if (parsed) data = parsed;
      }

      if (data && typeof data === 'object' && data instanceof Date) {
        data = data.toISOString();
      }

      td.textContent = colSpec.getter(rowObj);
      tr.appendChild(td);
    }
  }

}
