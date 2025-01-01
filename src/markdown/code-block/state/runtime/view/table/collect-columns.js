// @ts-check

import { parseDate } from './parse-date';

/**
 * @typedef {{
 *  key: string,
 *  getter: (rowObj: any) => any,
 *  setter?: (rowObj: any, value: any) => void,
 *  types: {
 *    number?: { min: number, max: number, count: number },
 *    string?: { set: Map<string, number>, count: number },
 *    [type: string]: undefined | number
 *      | { min: number, max: number, count: number }
 *      | { set: Map<string, number>, count: number }
 *  },
 *  bestType?: string,
 *  subColumns?: ColumnSpec[] & { maxDepth: number, totalWidth: number },
 *  nameLike?: number,
 *  dateLike?: number
 * }} ColumnSpec
 */

const MAX_NESTED_COLUMN = 6;
export const MAX_ANALYZE_ROWS = 5000;

const DATE_WORDS_LOWERCASE = new Map(Object.entries({
  timestamp: 3500,
  date: 3000,
  time: 2900,
  day: 1700,
  month: 1500,
  year: 1400,

  created: 1100,
  creation: 190,
  create: 190,

  updated: 1100,
  update: 190,

  modify: 900,
  modified: 900,
  modification: 900,

  last: 150,
  recent: 145,
  next: 140,

  birthday: 2000
}));

const NAME_WORDS_LOWERCASE = new Map(Object.entries({
  name: 1000,
  displayname: 900,
  title: 800,
  label: 800,
  caption: 800,
  type: 700,
  category: 700,
  kind: 700,

  handle: 510,
  code: 500,
  id: 10
}));

const IGNORE_GENERIC_WORDS_LOWERCASE = new Set([
  'like', 'is',
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'all', 'each', 'every',
  'value', 'values', 'field', 'fields', 'column', 'columns', 'row', 'rows', 'entry', 'entries',
]);


const WORD_REGEXP = new RegExp(
  [...new Set([
    ...DATE_WORDS_LOWERCASE.keys(),
    ...NAME_WORDS_LOWERCASE.keys(),
  ])].sort((a, b) => b.length - a.length).join('|'),
  'gu');

/**
 * @param {any[]} array
 */
export function collectColumns(array) {
  /** @type {ColumnSpec[]} */
  const leafColumns = [];

  const columns = /** @type {NonNullable<ReturnType<typeof collectSubColumns>> & { leafColumns: ColumnSpec[] } | undefined} */(
    collectSubColumns(
      array,
      0,
      leafColumns));
  if (columns) {
    columns.leafColumns = leafColumns;

    for (let i = 0; i < leafColumns.length; i++) {
      const leafCol = leafColumns[i];

      let excess = 0;
      let nameLike = 0;
      let dateLike = 0;
      let wordPos = 0;
      if (leafCol.bestType !== 'string' && leafCol.bestType !== 'date') continue;

      leafCol.key.toLowerCase().replace(WORD_REGEXP, (word, matchOffset) => {
        if (matchOffset > wordPos)
          excess += (matchOffset - wordPos) * (matchOffset - wordPos) * 10;

        const nameScore = leafCol.bestType !== 'string' ? 0 :
          NAME_WORDS_LOWERCASE.get(word);
        if (nameScore) nameLike += nameScore;

        const dateScore = leafCol.bestType !== 'date' ? 0 :
          DATE_WORDS_LOWERCASE.get(word);
        if (dateScore) dateLike += dateScore;

        wordPos = matchOffset + word.length;

        return word;
      });

      nameLike -= excess;
      //dateLike -= excess;

      if (nameLike > 0) leafCol.nameLike = nameLike;
      if (dateLike > 0) leafCol.dateLike = dateLike;
    }
  }

  return columns;
}

/**
 * @param {any[]} array
 * @param {number} depth
 * @param {ColumnSpec[]} leafColumns
 */
function collectSubColumns(array, depth, leafColumns) {
  /** @type {Record<string, ColumnSpec>} */
  const columns = {};
  let nullRows = 0;
  let valueRows = 0;
  let arrayRows = 0;

  let rowsAnalyzed = 0;

  for (let entry of array) {
    if (!entry && typeof entry !== 'string') {
      nullRows++;
      continue;
    }
    if (typeof entry !== 'object') {
      valueRows++;
      continue;
    }
    if (Array.isArray(entry)) {
      arrayRows++;
      continue;
    }

    for (const key in entry) {
      let colSpec = columns[key] ||
        (columns[key] = createColSpec(key));

      let value = entry[key];
      let type =
        value == null ? 'null' :
          typeof value !== 'object' ? typeof value :
            Array.isArray(value) ?
              (value.length === 1 && value[0] && typeof value[0] === 'object' && !Array.isArray(value[0]) ? '[object]' :
                'array'
              ) :
              'object';

      if (type === 'number' || type === 'string' || type === 'object' && value instanceof Date) {
        const dateValue = parseDate(value);
        if (dateValue) {
          value = dateValue;
          type = 'date';
        }
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        /** @type {*} */
        const numSpec = colSpec.types[type];
        colSpec.types[type] = {
          min: !numSpec || value < numSpec.min ? value : numSpec.min,
          max: !numSpec || value > numSpec.max ? value : numSpec.max,
          count: (numSpec ? numSpec.count : 0) + 1
        };
      } else if (type === 'date') {
        /** @type {*} */
        const dateSpec = colSpec.types[type];
        colSpec.types[type] = {
          min: !dateSpec || value < dateSpec.min ? value : dateSpec.min,
          max: !dateSpec || value > dateSpec.max ? value : dateSpec.max,
          count: (dateSpec ? dateSpec.count : 0) + 1
        };
      } else if (type === 'string') {
        if (!colSpec.types.string) colSpec.types.string = { set: new Map(), count: 0 };
        colSpec.types.string.count++;
        colSpec.types.string.set.set(
          value,
          (colSpec.types.string.set.get(value) || 0) + 1
        );
      } else {
        const count = colSpec.types[type];
        colSpec.types[type] = typeof count === 'number' ? count + 1 : 1;
      }
    }

    rowsAnalyzed++;
    if (rowsAnalyzed > MAX_ANALYZE_ROWS)
      break;
  }

  // not a coherent array of objects
  if (nullRows > array.length / 2 || valueRows > array.length / 4 || arrayRows > array.length / 4)
    return undefined;

  for (const colSpec of Object.values(columns)) {
    const types = Object.entries(colSpec.types);
    types.sort(([type1, stats1], [type2, stats2]) => {
      const count1 = typeof stats1 === 'number' ? stats1 : /** @type {*} */(stats1)?.count;
      const count2 = typeof stats2 === 'number' ? stats2 : /** @type {*} */(stats2)?.count;
      return (count2 || 0) - (count1 || 0);
    });

    colSpec.bestType = types[0][0];
    if (colSpec.bestType === 'null' && types.length > 1)
      colSpec.bestType = types[1][0];
    if (colSpec.bestType === '[object]')
      colSpec.key += '[0]';
  }

  const columnsWithConsistentData = /** @type {ColumnSpec[] & { maxDepth: number, totalWidth: number }} */(
    Object.values(columns).filter(
      colDesc => {
        const stats = colDesc.types[colDesc.bestType || ''];
        const count = typeof stats === 'number' ? stats : /** @type {*} */(stats)?.count;
        return (count || 0) > Math.min(4, array.length / 10);
      }
    ));
  columnsWithConsistentData.maxDepth = 1;
  columnsWithConsistentData.totalWidth = columnsWithConsistentData.length;

  if (!columnsWithConsistentData.length) return;

  if (depth <= MAX_NESTED_COLUMN) {
    for (const col of columnsWithConsistentData) {
      if (col.bestType === 'object' || col.bestType === '[object]') {
        const objectRows = array.map(entry => {
          if (!entry || typeof entry !== 'object') return;
          let valueEntry = col.getter(entry);
          if (!valueEntry || typeof valueEntry !== 'object') return;
          if (Array.isArray(valueEntry))
            return valueEntry.length === 1 ? valueEntry[0] : undefined;
          else
            return valueEntry;
        }).filter(Boolean);

        if (objectRows.length < 2) {
          console.log(
            'collect ' + col.key + ' NO subColumns ',
            objectRows,
            col.subColumns,
            ' EXAMPLE ', array[0], col.key, ' --> ', col.getter(array[0]));
          leafColumns.push(col);
          continue;
        }

        col.subColumns = collectSubColumns(
          objectRows,
          depth + 1,
          leafColumns
        );

        if (!col.subColumns?.length) {
          col.subColumns = undefined;
          leafColumns.push(col);
        } else {
          for (const subCol of col.subColumns) {
            subCol.key = col.key + '.' + subCol.key;
            const subGetter = subCol.getter;
            const subSetter = subCol.setter;

            subCol.getter = rowObj => {
              const sub = col.getter(rowObj);
              if (sub != null) return subGetter(sub);
            };

            if (subSetter) {
              subCol.setter = (rowObj, value) => {
                let sub = col.getter(rowObj);
                if (sub == null) {
                  if (!col.setter) return;

                  sub = {};
                  if (subCol.bestType === '[object]') col.setter(rowObj, [sub]);
                  else col.setter(rowObj, sub);
                }
                subSetter(sub, value);
              };
            }
          }

          columnsWithConsistentData.maxDepth = Math.max(columnsWithConsistentData.maxDepth, col.subColumns.maxDepth + 1);
          columnsWithConsistentData.totalWidth += col.subColumns.totalWidth - 1;
        }

        // console.log('collect '+ col.key + ' subColumns ', objectRows, col.subColumns);
      } else {
        leafColumns.push(col);
      }
    }
  } else {
    for (const col of columnsWithConsistentData) {
      leafColumns.push(col);
    }
  }

  return columnsWithConsistentData;

  function createColSpec(key) {
    const colSpec = {
      key,
      getter,
      setter,
      types: {}
    };

    return colSpec;

    function getter(rowObj) {
      const val = rowObj?.[key];
      if (colSpec.bestType === '[object]')
        return val?.[0];

      else
        return val;
    }

    function setter(rowObj, value) {
      if (!rowObj) return;

      if (colSpec.bestType === '[object]')
        rowObj[key] = [value];

      else
        rowObj[key] = value;
    }
  }
}
