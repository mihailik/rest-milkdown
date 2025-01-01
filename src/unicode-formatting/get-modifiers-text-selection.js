// @ts-check

import { applyModifier } from './apply-modifier';
import { runParseRanges } from './run-parse-ranges';

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {{
 *  text: string;
 *  start: number;
 *  end: number;
 *  parsed: import('./create-unicode-formatter-parser').ParsedList;
 * } | undefined};
 */
export function getModifiersTextSection(text, start, end) {
  var modText = text;
  if (start !== end) {
    modText = modText.slice(start, end);
    return { text: modText, start: start, end: end, parsed: runParseRanges(modText, void 0) };
  }

  var consequentMatch = /\S+\s*$/.exec(text.slice(0, start))?.[0];
  var consequentEntryStart = start - (consequentMatch?.length || 0);

  if (consequentMatch && /\S$/i.test(consequentMatch)) {
    // lead word is not separated from cursor by a space, continue the word on the trail side
    const furtherConsequentMatch = /^\S+/.exec(text.slice(start))?.[0];
    if (furtherConsequentMatch) {
      consequentMatch += furtherConsequentMatch;
    }
  }

  if (!consequentMatch) {
    // if cannot find consequent BEFORE, try consequent AFTER
    consequentMatch = /^\s*\S+/.exec(text.slice(start))?.[0];
    if (!consequentMatch) return { text: '', start: start, end: start, parsed: runParseRanges('', void 0) };
    var parsed = runParseRanges(consequentMatch, void 0);
  } else {
    var parsed = runParseRanges(consequentMatch, void 0);
  }

  if (!parsed.length) return { text: '', start: start, end: start, parsed: parsed };

  return {
    text: consequentMatch,
    start: consequentEntryStart,
    end: consequentEntryStart + consequentMatch.length,
    parsed
  };
}