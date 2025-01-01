// @ts-check

import { renderValue } from './render-value';
import { parse } from '../../../../../../../node_modules/csv-parse/dist/esm/sync';

import './render-string.css';

const MIN_SIZE_FOR_INTERPRETING = 10;

/**
 * @param {import('.').ValueRenderParams<string>} params
 */
export function renderString(params) {
  const { value, path, indent: originialIndent, wrap, invalidate, state } = params;

  const interpreted = interpretString(value);
  if (!interpreted) {
    params.wrap.availableHeight = Math.max(0, params.wrap.availableHeight - 1);

    // TODO: collapse too large string
    // TODO: provide option to render multiline strings unwrapped, without \n escapes
    // TODO: unwrap markdown too
    return { class: 'string-empty hi-string', textContent: !value ? '""' : JSON.stringify(value) };
  }

  const delegateWrap = { availableHeight: wrap.availableHeight - 2 };
  let renderedParsed = renderValue({
    value: interpreted.parsed,
    path: path + '.parse()',
    indent: originialIndent + '  ',
    wrap: delegateWrap,
    invalidate,
    state
  });
  wrap.availableHeight = delegateWrap.availableHeight;

  if (Array.isArray(renderedParsed)) {
    renderedParsed.unshift(
      { class: 'hi-string', textContent: '"' },
      { class: 'hi-json-mark-start', textContent: interpreted.markers[0] });

    renderedParsed.push(
      { class: 'hi-json-mark-end', textContent: interpreted.markers[1] },
      { class: 'hi-string', textContent: '"' }
    );
  } else {
    renderedParsed = [
      { class: 'hi-string', textContent: '"' },
      { class: 'hi-json-mark-start', textContent: interpreted.markers[0] },
      renderedParsed,
      { class: 'hi-json-mark-end', textContent: interpreted.markers[1] },
      { class: 'hi-string', textContent: '"' }
    ];
  }

  return renderedParsed;
}

const MIN_CSV_ROWS = 2;
const MIN_CSV_COLUMNS = 3;

/** @param {string} trimmed */
function likelyJSON(trimmed) {
  return (
    trimmed.startsWith('{') && trimmed.endsWith('}') ||
    trimmed.startsWith('[') && trimmed.endsWith(']')
  );
}

/** @param {string} trimmed */
function likelyCSV(trimmed) {
  let pos = 0;
  const rowsCommas = [];
  const rowsTabs = [];

  const COMMA = (',').charCodeAt(0);
  const TAB = ('\t').charCodeAt(0);

  while (pos < trimmed.length && pos < 3000) {
    let nextNewLine = trimmed.indexOf('\n', pos);
    if (nextNewLine < 0) nextNewLine = trimmed.length;
    if (nextNewLine === pos) break;

    let commas = 0;
    let tabs = 0;

    for (let i = pos; i < nextNewLine; i++) {
      if (trimmed.charCodeAt(i) === COMMA) commas++;
      if (trimmed.charCodeAt(i) === TAB) tabs++;
    }

    rowsCommas.push(commas);
    rowsTabs.push(tabs);

    pos = nextNewLine + 1;
  }

  if (rowsCommas.length < MIN_CSV_ROWS) return undefined;

  const avgCommas = rowsCommas.reduce((a, b) => a + b, 0) / rowsCommas.length;
  const avgTabs = rowsTabs.reduce((a, b) => a + b, 0) / rowsTabs.length;

  if (avgCommas > avgTabs) {
    if (avgCommas > MIN_CSV_COLUMNS) return ',';
  } else {
    if (avgTabs > MIN_CSV_COLUMNS) return '\t';
  }
}

/** @param {string} trimmed */
function likelySVGorXMLorHTML(trimmed) {
}

/** @param {string} trimmed */
function likelyTeX(trimmed) {

}

/**
 * @param {string} str
 */
export function interpretString(str) {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed.length < MIN_SIZE_FOR_INTERPRETING) return;

  // handling JSON island inside string
  if (likelyJSON(trimmed)) {
    let parsed;
    let parsedMarkers;
    try {
      return { parsed: JSON.parse(trimmed), markers: ['JSON', 'JSON'] };
    } catch (error) {
      const removeLeadingZeroes = trimmed.replace(/^\0+/, '');
      const removeSurroundingZeroes = removeLeadingZeroes.replace(/\0+$/, '');
      if (removeSurroundingZeroes !== trimmed) {
        try {
          return {
            parsed: JSON.parse(removeSurroundingZeroes),
            markers: [
              removeLeadingZeroes === trimmed ? 'JSON/' : 'zJSON/',
              removeSurroundingZeroes === removeLeadingZeroes ? '/JSON' : 'JSONz'
            ]
          };
        } catch { }
      }

      if (!parsedMarkers) {
        const trimmedInsideZeroes = removeSurroundingZeroes.trim();
        const posNewLine = trimmedInsideZeroes.indexOf('\n');
        if (posNewLine >= 0) {
          const openBracket = trimmedInsideZeroes.charAt(0);
          const closeBracket = trimmedInsideZeroes.charAt(posNewLine - 1);
          if (openBracket === '{' && closeBracket === '}' ||
            openBracket === '[' && closeBracket === ']') {
            const lines = trimmedInsideZeroes.split('\n');
            let jsonlFailed;
            const jsonlParsed = lines.map(ln => {
              if (jsonlFailed) return;
              try {
                return JSON.parse(ln);
              } catch {
                jsonlFailed = true;
              }
            });

            if (!jsonlFailed)
              return {
                parsed: jsonlParsed,
                markers: [
                  removeLeadingZeroes === trimmed ? 'JSON-L/' : 'zJSON-L/',
                  removeSurroundingZeroes === removeLeadingZeroes ? '/JSON-L' : 'JSON-Lz'
                ]
              };
          }
        }
      }
    }
  }

  const csv = likelyCSV(trimmed);
  if (csv) {
    try {
      const parsed = parse(
        trimmed,
        {
          delimiter: csv,
          columns: true,
          skip_empty_lines: true,
          cast: true
        });
      
      if (parsed.length < MIN_CSV_ROWS) return;

      return { parsed, markers: ['CSV', 'CSV'] };
    } catch { }
  }
}
