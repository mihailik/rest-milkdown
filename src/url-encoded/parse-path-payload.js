// @ts-check

const verbRegex = /^[A-Z]+:/i;
const urlLeadRegex = /^[A-Z]+\//i;

const MAX_VERB_LENGTH = 10;
const MAX_SCHEMA_LENGTH = 10;

/**
 * @param {string} pathPayload
 * @returns {{
 *  verb: string,
 *  addr?: string,
 *  body?: string,
 *  impliedVerb?: boolean
 * }}
 */
export function parsePathPayload(pathPayload) {
  if (pathPayload.charAt(0) === '/') {
    return {
      verb: 'text',
      body: decodeBodyLines(pathPayload.slice(1)),
      impliedVerb: true
    };
  }

  const verbMatch = verbRegex.exec(pathPayload);
  // watch out for excessively long verbs
  if (verbMatch && verbMatch[0].length > MAX_VERB_LENGTH) {
    return { verb: 'text', body: decodeBodyLines(pathPayload), impliedVerb: true };
  }
    
  let verb;
  let furtherPayloadOffset;
  if (verbMatch) {
    verb = verbMatch[0].slice(0, -1).toLowerCase();
    furtherPayloadOffset = verbMatch[0].length;
  } else {
    const urlMatch = urlLeadRegex.exec(pathPayload);
    if (!urlMatch || urlMatch[0].length > MAX_SCHEMA_LENGTH) {
      return { verb: 'text', body: decodeBodyLines(pathPayload), impliedVerb: true };
    }
    verb = '';
    furtherPayloadOffset = 0;
  }

  let addrEndPos = pathPayload.indexOf('//', furtherPayloadOffset);
  if (addrEndPos > furtherPayloadOffset && pathPayload.charAt(addrEndPos - 1) === ':')
    addrEndPos = pathPayload.indexOf('//', addrEndPos + 2);

  if (addrEndPos < 0) addrEndPos = pathPayload.length;

  const addr = decodePath(pathPayload.slice(furtherPayloadOffset, addrEndPos));

  let body;
  let impliedVerb = !verb;
  if (addrEndPos + 2 < pathPayload.length) {
    body = decodeBodyLines(pathPayload.slice(addrEndPos + 2));
    if (!verb) verb = 'post';
  } else {
    if (!verb) verb = 'get';
  }

  return {
    verb,
    addr,
    body,
    impliedVerb
  };
}

/**
 * @param {string} content
 */
function decodePath(content) {
  return decodeURIComponent(content.replace(/\+/, ' '));
}

const decodeBodyLines_regex = /([^\/\+]*)((\/)|(\+))?/gi;

/**
 * @param {string} bodyRaw
 * @returns {string}
 */
function decodeBodyLines(bodyRaw) {
  var body = bodyRaw.replace(
    decodeBodyLines_regex,
    function (whole, plain, remain, slash, plus) {
      return decodeURIComponent(plain || '') + (
        slash ? '\n' :
          plus ? ' ' :
            (remain || '')
      );
    }
  );

  return body;
}