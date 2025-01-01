// @ts-check

// import { calcTotals } from './calc-totals';
import { createAgGridColumns, createAgGridTable, gridHeightForRowsAndColumns } from './create-ag-grid-table';
import { createHtmlTable } from './create-html-table';
import { loadAgGrid } from './load-ag-grid';

/**
 * @param {{
 *  value: any[],
 *  columns: NonNullable<ReturnType<import('./collect-columns').collectColumns>>,
 *  indent: string,
 *  invalidate: () => void
 * }} _
 */
export function createTableView({ value, columns, indent, invalidate }) {
  const tablePanel = document.createElement('div');
  tablePanel.className = 'table-view-panel';
  tablePanel.style.paddingLeft = (indent.length * 0.4).toFixed(2) + 'em';

  /** @type {import('ag-grid-community').GridApi} */
  let agGridInstance;
  let rebindAgGrid;
  let resizeAgGridColumns;
  let table;

  rebindGrids();

  return {
    panel: tablePanel,
    rebind
  };

  function rebindGrids() {
    if (agGridInstance && rebindAgGrid) {
      rebindAgGrid(columns, value);
      table.style.height = gridHeightForRowsAndColumns(value.length, columns);
      return;
    }

    const agGridOrPromise = loadAgGrid();
    if (typeof agGridOrPromise.then === 'function') {
      agGridOrPromise.then(agGrid => {
        if (agGridInstance) return;
        table.remove();
        if (!tablePanel.parentElement) return;

        const createdGrid = createAgGridTable(columns, value, agGrid);
        table = createdGrid.containerElement;
        agGridInstance = createdGrid.agGrid;
        rebindAgGrid = createdGrid.rebindGrid;
        resizeAgGridColumns = createdGrid.resizeAgGridColumns;
        tablePanel.appendChild(table);
        resizeAgGridColumns?.();
     });

      table?.remove();
      let limitColumns = columns;
      if (limitColumns.length > 20) limitColumns.length = 20;

      let limitRows = value;
      if (limitRows.length > 80) limitRows = limitRows.slice(0, 80);

      table = createHtmlTable(limitColumns, limitRows);
      tablePanel.appendChild(table);
    } else {
      table?.remove();
      const createdGrid = createAgGridTable(columns, value, agGrid);
      table = createdGrid.containerElement;
      agGridInstance = createdGrid.agGrid;
      tablePanel.appendChild(table);
      resizeAgGridColumns?.();
    }
  }

  /** @param {Omit<Parameters<typeof createTableView>[0], 'invalidate'>} args */
  function rebind(args) {
    // no need to rebind aggressively on same value
    if (args.value === value && columns.length === args.columns.length) return;
    value = args.value;
    columns = args.columns;

    rebindGrids();
  }
}
