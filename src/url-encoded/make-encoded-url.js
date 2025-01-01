// @ts-check

import { parsePathPayload } from './parse-path-payload';

/**
 * @param {string} verb
 * @param {string} addr
 * @param {string} body
 */
export function makeEncodedURL(verb, addr, body) {
  if ((!verb || verb === 'text') && !addr) {
    if (!body) return '';
    const normalizedBody = normalizeBody(body);
    const trySlim = parsePathPayload(normalizedBody);
    if (trySlim.body === body) return normalizedBody;
    else return '/' + normalizedBody;
  }

  if (!verb) {
    if (addr) {
      if (!/^(http|https):/i.test(addr)) verb = 'GET';
    }
    else verb = 'text';
  }

  if (verb) {
    var normalizedUrl = !addr ? '' :
      encodeURI(addr)
        .replace(
          /(^http:)|(^https:)|(\/\/)|(#)|(\&)|(\?)/gi,
          function (whole, httpPrefix, httpSecurePrefix, slash, hash, ampersand, question) {
            return (
              slash ? '/%2F' :
                hash ? '%23' :
                  ampersand ? '%26' :
                    question ? '%3F' :
                      whole
            );
          });
  } else {
    var normalizedUrl = !addr ? '' :
      encodeURI(addr)
        .replace(
          /(^http:(\/\/)?)|(^https:(\/\/)?)|(\/\/)|(#)|(\&)|(\?)/gi,
          function (whole, httpPrefix, httpSecurePrefix, httpSlash2, httpsSlash2, slash, hash, ampersand, question) {
            return (
              slash ? '/%2F' :
                hash ? '%23' :
                  ampersand ? '%26' :
                    question ? '%3F' :
                      whole
            );
          });
  }

  var normalizedBody = normalizeBody(body);
  
  if (verb === 'text') {
    const trySlim = parsePathPayload(normalizedBody);
    if ((trySlim.body || '') === body && (trySlim.addr || '') === addr)
      return normalizedBody;
  }

  var result =
    plainTextVerbs[verb] ? verb + '/' + normalizedBody :
      (verb ? verb + '/' : '') + (normalizedUrl ? normalizedUrl : '') + (
        (normalizedBody && (verb || normalizedUrl)) ? '//' + normalizedBody : normalizedBody || ''
      );
  return result;
}

const plainTextVerbs = {
  edit: true,
  text: true,
  read: true,
  view: true
};

/** @param {string} body */
function normalizeBody(body) {
  return body
    .replace(
      /([^\n\/\+ \#\&\?]*)((\n)|(\/)|(\+)|( )|(#)|(\&)|(\?))/gi,
      function (whole, plain, remain, newLine, slash, plus, space, hash, ampersand, question) {
        return encodeURI(plain || '') + (
          newLine ? '/' :
            slash ? '%2F' :
              plus ? '%2B' :
                space ? '+' :
                  hash ? '%23' :
                    ampersand ? '%26' :
                      question ? '%3F' :
                        (remain || '')
        );
      }
    );
}
