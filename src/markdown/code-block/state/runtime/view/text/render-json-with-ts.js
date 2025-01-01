// @ts-check

import { collectRanges } from '../../../../../../typescript-services/collect-ranges';
import { prettifyJson } from '../../../../../../typescript-services/prettify-json';
import { getHighlightSpansForCode } from '../../../../state-javascript/plugin-highlights';

/**
 * @param {import('.').ValueRenderParams} params
 * @param {import('../../../../../../typescript-services').LanguageServiceAccess} accessLang
 */
export function renderJsonWithTS({ value, invalidate, state }, accessLang) {

  const prettifiedJson = prettifyJson(value, accessLang);

  accessLang.update({
    'file.json': prettifiedJson
  });
  const highlights = getHighlightSpansForCode(accessLang, prettifiedJson, 'file.json');
  const { allRanges } = collectRanges(accessLang, 'file.json') || {};

  let pos = 0;
  let iRange = 0;
  let iHighlight = 0;

  /** @type {import('..').RenderedContent[]} */
  const output = [];

  while (pos < prettifiedJson.length) {
    let hi = nextHighlightAfter(pos);
    let range = nextRangeAfter(pos);

    let nextStart = prettifiedJson.length;
    if (hi && hi.from <= nextStart) {
      nextStart = hi.from;
    } else {
      hi = undefined;
    }

    if (range && range.from <= nextStart) {
      nextStart = range.from;
    } else {
      range = undefined;
    }

    if (pos < nextStart) {
      output.push({
        class: 'success success-json',
        textContent: prettifiedJson.slice(pos, nextStart)
      });
      pos = nextStart;
    }

    if (range) {
      renderRange(range, iRange);
    } else if (hi) {
      output.push({
        class: 'success success-json ' + hi.class,
        textContent: prettifiedJson.slice(hi.from, hi.to)
      });
      pos = hi.to;
    } else if (pos < prettifiedJson.length) {
      output.push({
        class: 'success success-json',
        textContent: prettifiedJson.slice(pos)
      });
      pos = prettifiedJson.length;
    }
  }
  return output;

  /**
   * @param {number} to
   * @param {string} trailingClass
   */
  function renderHighlightsUntil(to, trailingClass) {
    while (pos < to) {
      let hi = nextHighlightAfter(pos);
      if (hi && hi.from <= to) {
        if (hi.from > pos) {
          output.push({
            class: 'success success-json',
            textContent: prettifiedJson.slice(pos, hi.from)
          });
          pos = hi.from;
        }

        const end = Math.min(hi.to, to);
        output.push({
          class: 'success success-json ' + hi.class + (end === to ? ' ' + trailingClass : ''),
          textContent: prettifiedJson.slice(pos, end)
        });
        pos = end;
        iHighlight++;
      } else {
        if (pos < to) {
          output.push({
            class: 'success success-json ' + trailingClass,
            textContent: prettifiedJson.slice(pos, to)
          });
          pos = to;
        }
      }
    }
  }

  /**
   * @param {import('../../../../../../typescript-services/collect-ranges').SemanticRange} range
   * @param {number} rangeIndex
   */
  function renderRange(range, rangeIndex) {
    let expanded = state['expanded-' + rangeIndex];
    if (typeof expanded !== 'boolean') expanded = !range.recommendCollapse;

    if (pos < range.from) {
      renderHighlightsUntil(range.from, '');
    }

    if (!expanded) {
      if (range.from < range.foldFrom) {
        renderHighlightsUntil(range.foldFrom, 'json-collapse-hint');
      }

      output.push({
        widget: () => {
          const button = document.createElement('button');
          button.className = 'json-toggle-expand';
          button.textContent = '...' + (range.toLine - range.fromLine - 1).toLocaleString() + ' lines...';
          button.title = prettifiedJson.slice(range.foldFrom, range.foldTo);
          button.onclick = () => {
            state['expanded-' + rangeIndex] = true;
            invalidate();
          };
          return button;
        }
      });

      output.push({
        class: 'render-result-range-collapse-all',
        textContent: prettifiedJson.slice(range.foldFrom, range.foldTo)
      })

      pos = range.foldTo;

      if (range.foldTo < range.to) {
        renderHighlightsUntil(range.to, '');
      }
    } else {
      if (range.foldFrom > range.from) {
        renderHighlightsUntil(range.foldFrom, 'json-collapse-hint');
      }

      output.push({
        widget: () => {
          const button = document.createElement('button');
          button.className = 'json-toggle-collapse';
          button.onclick = () => {
            state['expanded-' + rangeIndex] = false;
            invalidate();
          };
          return button;
        }
      });

      pos = range.foldFrom;
    }

    iRange++;
  }

  /** @param {number} pos */
  function nextHighlightAfter(pos) {
    while (iHighlight < highlights.length && highlights[iHighlight].from < pos) {
      iHighlight++;
    }

    return iHighlight < highlights.length ? highlights[iHighlight] : undefined;
  }

  /** @param {number} pos */
  function nextRangeAfter(pos) {
    if (!allRanges) return undefined;
    while (iRange < allRanges.length && allRanges[iRange].from < pos) {
      iRange++;
    }
    return iRange < allRanges.length ? allRanges[iRange] : undefined;
  }
}
