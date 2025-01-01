// @ts-check

// import { calcTotals } from './calc-totals';
import { dateCellRenderer } from './date-column';
import { numberCellRenderer, numberTotalCellRenderer } from './number-column';
import { performCopyFromAgGrid } from './perform-copy-from-ag-grid';

/**
 * @param {NonNullable<ReturnType<import('./collect-columns').collectColumns>>} columns
 * @param {any} result
 * @param {typeof import('ag-grid-community')} agGrid
 */
export function createAgGridTable(columns, result, agGrid) {
  const gridParent = document.createElement('div');
  gridParent.className = 'ag-theme-balham';
  gridParent.style.cssText = 'position: relative; width: 100%; overflow: auto;';
  gridParent.style.height = gridHeightForRowsAndColumns(result.length, columns);

  /** @type {import('ag-grid-community').CellPosition | undefined | null} */
  let rangeSelectionHead;

  // const totals = calcTotals(result, columns);

  const agGridInstance = agGrid.createGrid(
    gridParent,
    {
      columnDefs: createAgGridColumns(
        columns,
        isCellSelected
      ),
      rowData: result,
      // pinnedBottomRowData: [totals],
      defaultColDef: {
        flex: 1,
        minWidth: 100,
        resizable: true,
        sortable: true,
        filter: true,
      },
      // domLayout: 'autoHeight',
      autoSizePadding: 10,
      animateRows: true,
      onCellFocused: handleCellFocused,
    });

  gridParent.onkeydown = handleKeyDown;
  gridParent.onkeyup = handleKeyUp;
  gridParent.onmousedown = handleMouseDown;
  gridParent.onmouseup = handleMouseUp;

  return {
    containerElement: gridParent,
    agGrid: agGridInstance,
    rebindGrid,
    resizeGridColumns
  };

  /**
   * @type {NonNullable<Parameters<typeof createAgGridColumns>[1]>}
   */
  function isCellSelected(colSpec, params) {
    const selectionRange = getSelectionRange();
    if (selectionRange &&
      params.rowIndex >= selectionRange.from.row && params.rowIndex <= selectionRange.to.row &&
      selectionRange.columns.indexOf(params.column) >= 0)
      return true;
  }

  /**
   * @param {Parameters<typeof createAgGridColumns>[0]} columns
   * @param {any[]} rows
   */
  function rebindGrid(columns, rows) {
    /** @type {import('ag-grid-community').ColDef[]} */
    const columnDefs = createAgGridColumns(columns, isCellSelected);
    const needsResize = agGridInstance.getGridOption('columnDefs')?.length !== columnDefs.length;

    const liveColumns = agGridInstance.getColumns();
    if (!needsResize && liveColumns?.length) {
      const columnDefsByKey = new Map(columnDefs.map(col => [col.field, col]));
      for (const col of liveColumns) {
        const w = col.getActualWidth();
        const colDef = columnDefsByKey.get(col.getColId());
        if (colDef && w) {
          colDef.width = w;
        }
      }
    }

    // const totals = calcTotals(value, columns);

    agGridInstance.updateGridOptions({
      columnDefs,
      rowData: rows,
      // pinnedBottomRowData: [totals]
    });
    if (needsResize) resizeGridColumns();
  }

  var debounceAutosize;
  function resizeGridColumns() {
    clearTimeout(debounceAutosize);
    debounceAutosize = setTimeout(() => {
      agGridInstance.autoSizeAllColumns();
    }, 1);
  }

  function getSelectionRange() {
    if (selectAll) {
      const columns = agGridInstance.getColumns();
      if (!columns) return;

      const rowCount = agGridInstance.getDisplayedRowCount();
      return {
        from: { row: 0, column: 0 },
        to: { row: rowCount - 1, column: columns.length - 1 },
        columns
      };
    }

    if (!rangeSelectionHead) return;

    const fCell = agGridInstance.getFocusedCell();
    if (!fCell) return;

    const columns = agGridInstance.getColumns();
    if (!columns) return;

    const focusedColumnIndex = columns.indexOf(fCell.column);
    if (focusedColumnIndex < 0) return;

    const continuousSelection =
      shiftDown || modDown || mouseDown;

    if (!continuousSelection) {
      // rangeSelectionHead = undefined;
      return {
        from: { row: fCell.rowIndex, column: focusedColumnIndex },
        to: { row: fCell.rowIndex, column: focusedColumnIndex },
        columns: [columns[focusedColumnIndex]]
      };
    }

    const r1 = Math.min(rangeSelectionHead.rowIndex, fCell.rowIndex);
    const r2 = Math.max(rangeSelectionHead.rowIndex, fCell.rowIndex);
    const headColumnIndex = columns.indexOf(rangeSelectionHead.column);

    if (headColumnIndex < 0 || focusedColumnIndex < 0) return;

    const c1 = Math.min(headColumnIndex, focusedColumnIndex);
    const c2 = Math.max(headColumnIndex, focusedColumnIndex);
    const selectColumns = columns.slice(c1, c2 + 1);

    return { from: { row: r1, column: c1 }, to: { row: r2, column: c2 }, columns: selectColumns };
  }

  /** @param {import('ag-grid-community').CellFocusedEvent} [event] */
  function handleCellFocused(event) {
    if (ignoreSelectionEventsWhileAnimating) return;

    const continuousSelection =
      shiftDown || modDown || mouseDown;

    if (!continuousSelection || !rangeSelectionHead)
      rangeSelectionHead = agGridInstance.getFocusedCell();

    settledSelection = getSelectionRange();

    selectAll = false;
    redrawSelection();
  }

  var shiftDown;
  var modDown;
  var mouseDown;
  var selectAll;
  var ignoreSelectionEventsWhileAnimating;
  var settledSelection;

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event) {
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      selectAll = true;
      settledSelection = getSelectionRange();
      redrawSelection();
      return;
    }

    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      /** @type {*} */(event).stopPropagation?.();

      const saveHead = rangeSelectionHead;
      const selectionRange = settledSelection || getSelectionRange();
      ignoreSelectionEventsWhileAnimating = true;
      const focusedCell = agGridInstance.getFocusedCell();

      performCopyFromAgGrid({ agGridInstance, gridParent, selectionRange }).then(() => {
        if (focusedCell)
          agGridInstance.setFocusedCell(
            focusedCell.rowIndex,
            focusedCell.column,
            focusedCell.rowPinned);
        rangeSelectionHead = saveHead;
        settledSelection = selectionRange;
        ignoreSelectionEventsWhileAnimating = false;
        setTimeout(() => redrawSelection(), 10);
      });
    }

    shiftDown = event.shiftKey ? true : undefined;
    modDown = event.metaKey ? true : undefined;
  }

  /** @param {KeyboardEvent} event */
  function handleKeyUp(event) {
    shiftDown = event.shiftKey ? true : undefined;
    modDown = event.metaKey ? true : undefined;
  }

  /** @param {MouseEvent} event */
  function handleMouseDown(event) {
    const continuousSelection =
      shiftDown || modDown || mouseDown;

    if (event.button === 0) {
      mouseDown = true;
      if (!continuousSelection) rangeSelectionHead = agGridInstance.getFocusedCell();
    }
  }

  /** @param {MouseEvent} event */
  function handleMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  var redrawQueued;
  function redrawSelection() {
    const selectionRange = settledSelection || getSelectionRange();
    if (!selectionRange) return;

    const rowNodes = [];
    agGridInstance.forEachNodeAfterFilterAndSort(rowNode => {
      if (typeof rowNode.rowIndex !== 'number') return;
      if (rowNode.rowIndex >= selectionRange.from.row && rowNode.rowIndex <= selectionRange.to.row) {
        rowNodes.push(rowNode);
      }
    });

    clearTimeout(redrawQueued);
    redrawQueued = setTimeout(() => {
      agGridInstance.refreshCells();  //{ rowNodes, columns: selectionRange.columns });
    }, 10);
  }
}

/**
 * @param {number} rowCount
 *  @param {NonNullable<ReturnType<import('./collect-columns').collectColumns>>} columns
 */
export function gridHeightForRowsAndColumns(rowCount, columns) {
  return Math.min(30, Math.floor(rowCount * 2.7)) + Math.floor(columns.maxDepth * 2.8) + 'em';
}

/**
 * @param {NonNullable<ReturnType<import('./collect-columns').collectColumns>>} columns
 * @param {(colSpec: import('./collect-columns').ColumnSpec, params: import('ag-grid-community').CellClassParams) => boolean | undefined | null} [isCellSelected]
 */
export function createAgGridColumns(columns, isCellSelected) {
  console.log('applying columns', columns);
  return columns.map(col => createColumn(col));

  /**
   * @param {NonNullable<ReturnType<import('./collect-columns').collectColumns>>[0]} colSpec
   */
  function createColumn(colSpec) {

    /** @type {*} */
    const stats = colSpec.bestType && colSpec.types[colSpec.bestType];
    const getter = colSpec.getter;
    const children = !colSpec.subColumns?.length ? undefined : colSpec.subColumns.map(col => createColumn(col));
    const cellRenderer =
      colSpec.bestType === 'number' && Number.isFinite(stats?.max) && Number.isFinite(stats?.min) ?
        numberCellRenderer :
        colSpec.bestType === 'date' ?
          dateCellRenderer :
          undefined;

    return /** @type {import('ag-grid-community').ColDef & { colSpec: import('./collect-columns').ColumnSpec }} */({
      colSpec,
      headerName: colSpec.key,
      field: colSpec.key,
      valueGetter: (params) => getter(params.data),
      cellRendererSelector: params =>
        params.node.rowPinned ? {
          component: numberTotalCellRenderer,
          params: { col: colSpec }
        } : {
          component: cellRenderer,
          params: { col: colSpec }
        },
      children,
      cellClassRules: !children?.length && isCellSelected ?
        {
          'imposed-cell-range-selected': params => isCellSelected(colSpec, params)
        } : undefined,
    });
  }
}
