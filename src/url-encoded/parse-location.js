// @ts-check

export const thisScriptURL = !document.scripts[document.scripts.length - 1]?.src ? undefined : new URL(document.scripts[document.scripts.length - 1]?.src);

export const MAX_PARSE_URL_LENGTH = 1975;

/**
 * @param {{ pathname: string, protocol: string, host: string, hash: string, search?: string }} [location]
 * @returns {{
 *  source: 'path' | 'hash',
 *  baseHref: string,
 *  pathLead?: string,
 *  payload: string
 * }}
 */
export function parseLocation(location) {
  if (!location) location = window.location;
  const hashPayload = location.hash.replace(/^#/, '');
  const queryPayload = (location.search || '').replace(/^\?/, '');

  if (/http/.test(location.protocol) && (!thisScriptURL || location.host === thisScriptURL?.host)) {
    if (/github\.io/i.test(location.host) || location.host.toLowerCase() === 'oyin.bo') {
      return {
        source: 'path',
        baseHref: location.pathname.slice(0, location.pathname.indexOf('/', 1) + 1),
        payload: hashPayload || location.pathname.slice(location.pathname.indexOf('/', 1) + 1)
      };
    } else if (/mocku\.me$/i.test(location.host)) {
      return {
        source: 'path',
        baseHref: '/',
        pathLead: 'nt/',
        payload: hashPayload || location.pathname.replace(/^\/(nt(\/|$))?/, '')
      };
    } else if (/\.vscode/i.test(location.host)) {
      var matchIndexHtml = /\/(index|404)\.html\b/i.exec(location.pathname || '');
      if (!matchIndexHtml) return {
        source: 'hash',
        baseHref: location.pathname,
        payload: hashPayload
      };

      return {
        source: 'hash',
        baseHref: location.pathname.slice(0, matchIndexHtml.index + 1),
        payload: hashPayload
      };
    } else {
      return {
        source: 'path',
        baseHref: '/',
        payload: queryPayload || hashPayload || location.pathname.replace(/^\//, '')
      };
    }
  } else {
    return {
      source: 'hash',
      baseHref: location.pathname,
      payload: queryPayload || hashPayload
    };
  }
}
