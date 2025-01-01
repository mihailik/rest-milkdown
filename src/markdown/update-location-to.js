// @ts-check

import { applyModifier } from '../unicode-formatting/apply-modifier';
import { runParseRanges } from '../unicode-formatting/run-parse-ranges';
import { makeEncodedURL } from '../url-encoded/make-encoded-url';
import { MAX_PARSE_URL_LENGTH, parseLocation } from '../url-encoded/parse-location';

/**
 * @param {string} text
 * @param {string} verb
 * @param {string} [logicalTitle]
 */
export function updateLocationTo(text, verb, logicalTitle) {
  // TODO: figure out if the verb/address need to be handled
  const url = makeEncodedURL(verb, '', text);
  const urlData = parseLocation();

  const title =
    logicalTitle ||
    text.split('\n').map(str => str.trim()).filter(Boolean)[0];

  if (title) {
    const parsedTitle = runParseRanges(title);
    const normalizedTitle =
      (parsedTitle ? parsedTitle.map(entry => typeof entry === 'string' ? entry : entry.plain).join('') : title);

    document.title = applyModifier(normalizedTitle.replace(/^[\.…]+/, ''), 'bold');
  } else {
    document.title = '𝗺𝗼𝗰𝗸𝘂𝗺𝗲𝗻𝘁';
  }

  let applyTo = urlData.source;
  /** @type {string | undefined} */
  let resetLocationToBarePathAndHash;

  const pathTooLong = url.length > MAX_PARSE_URL_LENGTH ||
    (location.hostname?.toLowerCase() || '') === 'localhost' && url.length > 256;

  const targetUrl =
    location.protocol + '//' + location.host + urlData.baseHref + (urlData?.pathLead || '');

  if (pathTooLong && applyTo === 'path') {
    applyTo = 'hash';

    if (location.href.split('#')[0] !== targetUrl)
      resetLocationToBarePathAndHash = targetUrl;
  } else if (applyTo === 'hash' && location.search && location.search !== '?') {
    resetLocationToBarePathAndHash = targetUrl;
  }

  switch (applyTo) {
    case 'path':

      history.replaceState(
        null,
        'unused-string',
        location.protocol + '//' + location.host + '/' + (urlData?.pathLead || '') + url);
      break;

    case 'hash':
    default:
      // update hash
      if (resetLocationToBarePathAndHash) {
        history.replaceState(
          null,
          'unused-string',
          resetLocationToBarePathAndHash);
      }

      location.hash = '#' + url;
      break;
  }
}
