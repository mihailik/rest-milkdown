// @ts-check

/**
 * @param {any[]} result
 * @param {import("./collect-columns").ColumnSpec[]} columns
 */
export function calcTotals(result, columns) {
  const totals = generateTotalsRow(columns);
  for (const row of result) {
    accumulateTotals(totals, row, columns);
  }
  return totals;

  /**
   * @param {import("./collect-columns").ColumnSpec[]} columns
   */
  function generateTotalsRow(columns) {
    const row = {};
    for (const col of columns) {
      /** @type {*} */
      let value = col.subColumns?.length ?
        generateTotalsRow(col.subColumns) :
        undefined;

      switch (col.bestType) {
        case 'object':
          value = value || {};
          break;
        case 'array':
          value = value ? [value] : [];
          break;
        case '[object]':
          value = [value || {}];
          break;
      }

      row[col.key] = value;
    }
    return row;
  }

  /**
   * @param {any} totals
   * @param {any} row
   * @param {import("./collect-columns").ColumnSpec[]} columns
   */
  function accumulateTotals(totals, row, columns) {
    for (const col of columns) {
      if (col.subColumns?.length) {
        accumulateTotals(col.getter(totals), col.getter(row), col.subColumns);
      } else if (col.bestType === 'number') {
        const val = col.getter(row);
        /** @type {{ min: number, max: number, sum: number, count: number } | undefined} */
        let agg = col.getter(totals);
        if (typeof val === 'number' && Number.isFinite(val)) {
          if (!agg) {
            col.setter?.(totals, { min: val, max: val, sum: val, count: 1 });
          } else {
            agg.min = Math.min(agg.min, val);
            agg.max = Math.max(agg.max, val);
            agg.sum += val;
            agg.count++;
          }
        }
      }
    }
  }
}