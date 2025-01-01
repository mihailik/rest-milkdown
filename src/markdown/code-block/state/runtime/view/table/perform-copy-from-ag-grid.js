// @ts-check

import { createHtmlTable } from './create-html-table';

/**
 * @param {{
 *  agGridInstance: import('ag-grid-community').GridApi,
 *  gridParent: HTMLElement,
 *  selectionRange: { from: { row: number; column: number; }; to: { row: number; column: number; }; columns: import('ag-grid-community').Column[]; } | undefined
 * }} _
 */
export async function performCopyFromAgGrid({ agGridInstance, gridParent, selectionRange }) {

  if (!selectionRange) return;

  const agColumns = agGridInstance.getColumns();
  if (!agColumns?.length) return;

  const fCell = agGridInstance.getFocusedCell();

  const { rows, columns } = manufactureColumnRowsForSelectionRange(selectionRange, agGridInstance);

  let copyElem;

  /** @type {{ top: number, left: number, right: number, bottom: number }} */
  let splashArea = gridParent.getBoundingClientRect();
  /** @type {typeof splashArea | undefined} */
  let headerArea;

  if (selectionRange &&
    selectionRange?.from.row === selectionRange?.to.row &&
    selectionRange?.from.column === selectionRange?.to.column) {
    let cellValue = undefined;
    agGridInstance.forEachNodeAfterFilterAndSort(rowNode => {
      if (!rowNode.rowPinned && rowNode.rowIndex === selectionRange.from.row) {
        cellValue = agGridInstance.getCellValue({
          rowNode,
          colKey: selectionRange.columns[0]
        });
      }
    });

    const cellDivWrapper = document.createElement('div');
    const cellDivContent = document.createElement('div');
    cellDivContent.textContent = String(cellValue ?? '');
    cellDivWrapper.appendChild(cellDivContent);
    copyElem = cellDivWrapper;

    const focusedCell = gridParent.querySelector('.ag-cell-focus');
    if (focusedCell) splashArea = focusedCell.getBoundingClientRect();
  } else {
    const renderTableHTML = createHtmlTable(columns, rows);
    copyElem = renderTableHTML;

    const headerOuterArea = gridParent.querySelector('.ag-header-container')?.getBoundingClientRect();
    const rangeCells = gridParent.querySelectorAll('.imposed-cell-range-selected');
    let cellFound = false;

    const outerArea = splashArea;
    for (const cell of rangeCells) {
      const cellArea = cell.getBoundingClientRect();
      if (!cellFound) {
        splashArea = { top: cellArea.top, left: cellArea.left, right: cellArea.right, bottom: cellArea.bottom };
        if (headerOuterArea)
          headerArea = { top: headerOuterArea.top, left: splashArea.left, right: splashArea.right, bottom: headerOuterArea.bottom };

        cellFound = true;
      } else {
        splashArea.top = Math.max(Math.min(splashArea.top, cellArea.top), outerArea.top);
        splashArea.left = Math.max(Math.min(splashArea.left, cellArea.left), outerArea.left);
        splashArea.right = Math.min(Math.max(splashArea.right, cellArea.right), outerArea.right);
        splashArea.bottom = Math.min(Math.max(splashArea.bottom, cellArea.bottom), outerArea.bottom);

        if (headerOuterArea && headerArea) {
          headerArea.left = Math.max(Math.min(headerArea.left, cellArea.left), outerArea.left);
          headerArea.right = Math.min(Math.max(headerArea.right, cellArea.right), outerArea.right);
        }
      }
    }
  }

  copyElem.style.cssText =
    // 'position: absolute; top: 5em; left: 5em; width: 20em; height: 10em; background: white; font-size: 70%; overflow: auto; border: solid 1px tomato; z-index: 1000;';
    'position: absolute; top: -1000px; left: -1000px; width: 200px; height: 200px; opacity: 0; font-size: 70%; overflow: hidden;';
  document.body.appendChild(copyElem);
  copyElem.contentEditable = 'true';
  const selRange = document.createRange();
  if (copyElem.firstChild) {
    selRange.selectNodeContents(copyElem.firstChild);
    const select = window.getSelection();
    select?.removeAllRanges();
    select?.addRange(selRange);

    window.document.execCommand('Copy', true);
  }

  setTimeout(() => {
    copyElem.remove();
  }, 10);


  if (fCell) agGridInstance.setFocusedCell(fCell.rowIndex, fCell.column, fCell.rowPinned);
  else /** @type {HTMLElement} */(gridParent.querySelector('.ag-cell'))?.focus();

  await animateCopySplash({ splashArea, headerArea });
}

/**
 * @param {{
 *  splashArea: { top: number, left: number, right: number, bottom: number },
 *  headerArea?: { top: number, left: number, right: number, bottom: number }
 * }} _
 */
async function animateCopySplash({ splashArea, headerArea }) {
  const splash = document.createElement('div');
  splash.style.cssText =
    'position: absolute; top: 0; left: 0; width: 10em; height: 10em; border: solid 0.6em #008452; background: #0084523b; opacity: 0.7; z-index: 1000; transition: pointer-events: none;';
  splash.style.top = splashArea.top + 'px';
  splash.style.left = splashArea.left + 'px';
  splash.style.width = (splashArea.right - splashArea.left) + 'px';
  splash.style.height = (splashArea.bottom - splashArea.top) + 'px';
  splash.style.filter = 'blur(0.5em)';
  document.body.appendChild(splash);

  let splashHeader
  if (headerArea) {
    splashHeader = document.createElement('div');
    splashHeader.style.cssText =
      'position: absolute; top: 0; left: 0; width: 10em; height: 10em; border: solid 0.2em #008452; background: #0084523b; opacity: 0.7; z-index: 1000; transition: pointer-events: none;';
    splashHeader.style.top = headerArea.top + 'px';
    splashHeader.style.left = headerArea.left + 'px';
    splashHeader.style.width = (headerArea.right - headerArea.left) + 'px';
    splashHeader.style.height = (headerArea.bottom - headerArea.top) + 'px';
    splashHeader.style.filter = 'blur(0.4em)';
    document.body.appendChild(splashHeader);
  }

  await new Promise(resolve => setTimeout(resolve, 1));
  splash.style.transition = 'all 1s';
  if (splashHeader) splashHeader.style.transition = 'all 1s';
  await new Promise(resolve => setTimeout(resolve, 1));
  splash.style.opacity = '0';
  splash.style.filter = 'blur(4em)';
  splash.style.transform = 'scale(1.5)';
  if (splashHeader) {
    splashHeader.style.opacity = '0';
    splashHeader.style.filter = 'blur(4em)';
    splashHeader.style.transform = 'scale(1.5)';
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  splash.remove();
  if (splashHeader) splashHeader.remove();
}

/**
 * @param {NonNullable<Parameters<typeof performCopyFromAgGrid>[0]['selectionRange']>} selectionRange
 * @param {import('ag-grid-community').GridApi} agGridInstance
 */
function manufactureColumnRowsForSelectionRange(selectionRange, agGridInstance) {

  const rows = [];
  const nodes = [];
  const rowIndex = new Map();

  agGridInstance.forEachNodeAfterFilterAndSort(rowNode => {
    if (!selectionRange || typeof rowNode.rowIndex !== 'number') return;
    if (rowNode.rowIndex >= selectionRange.from.row && rowNode.rowIndex <= selectionRange.to.row) {
      rows.push(rowNode.data);
      nodes.push(rowNode);
      rowIndex.set(rowNode.data, rows.length - 1);
    }
  });

  const columns =
    /** @type {NonNullable<ReturnType<import('./collect-columns').collectColumns>>} */(
      /** @type {*} */([])
    );
  columns.maxDepth = 0;
  columns.totalWidth = 0;

  columns.leafColumns = [];
  /** @type {Map<import('ag-grid-community').ColumnGroup, import('./collect-columns').ColumnSpec>} */
  const groupColDefToColumnSpec = new Map();

  for (let iColRange = 0; iColRange < selectionRange.columns.length; iColRange++) {
    const colDef = selectionRange.columns[iColRange];
    const colSpec =
      /** @type {typeof colDef & { colSpec?: import('./collect-columns').ColumnSpec }} */
      (colDef).colSpec;

    /** @type {import('./collect-columns').ColumnSpec} */
    const leafColSpec = {
      ...colSpec,
      key: colDef.getColId(),
      getter: row => {
        const iNode = rowIndex.get(row);
        const rowNode = nodes[iNode];
        return agGridInstance.getCellValue({
          rowNode,
          colKey: colDef
        });
      },
      types: colSpec?.types || {}
    };
    columns.leafColumns.push(leafColSpec);

    if (!colDef.getParent()?.getColGroupDef()?.headerName) {
      columns.push(leafColSpec);
    } else {
      let currentColSpec = leafColSpec;
      /** @type {import('ag-grid-community').Column | import('ag-grid-community').ColumnGroup} */
      let currentColDef = colDef;
      while (true) {
        /** @type {import('ag-grid-community').ColumnGroup | undefined | null} */
        const parentCol = currentColDef.getParent();
        if (!parentCol) {
          columns.push(currentColSpec);
          break;
        }

        const existingParentColSpec = groupColDefToColumnSpec.get(parentCol);
        if (existingParentColSpec) {
          if (!existingParentColSpec.subColumns) existingParentColSpec.subColumns = /** @type {*} */([currentColSpec]);
          else existingParentColSpec.subColumns.push(currentColSpec);
          break;
        } else {
          /** @type {import('./collect-columns').ColumnSpec} */
          const parentColSpec = {
            key: parentCol.getColGroupDef()?.headerName || parentCol.getGroupId(),
            getter: row => row,
            types: { 'object': 1 },
            bestType: 'object',
            subColumns: /** @type {*} */([currentColSpec])
          };
          groupColDefToColumnSpec.set(parentCol, parentColSpec);
          currentColDef = parentCol;
          currentColSpec = parentColSpec;
        }
      }
    }
  }

  updateStats(columns);

  return { columns, rows };
}

/** @param {import('./collect-columns').ColumnSpec[] & { maxDepth: number, totalWidth: number }} columns */
function updateStats(columns) {
  columns.maxDepth = 1;
  columns.totalWidth = columns.length;

  for (const col of columns) {
    if (col.subColumns) {
      updateStats(col.subColumns);
      columns.maxDepth = Math.max(columns.maxDepth, col.subColumns.maxDepth + 1);
      columns.totalWidth += col.subColumns.totalWidth - 1;
    }
  }
}
