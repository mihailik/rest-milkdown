// @ts-check

/** @param {string | undefined | null} requestText */
export function parseTextRequest(requestText) {
  if (!requestText) return;
  var firstNonwhitespace = /\S/.exec(requestText);
  if (!firstNonwhitespace) return;

  var firstLineStart = requestText.lastIndexOf('\n', firstNonwhitespace.index) + 1;

  var leadEmptyLines = requestText.slice(0, firstLineStart);
  var firstLineEnd = requestText.indexOf('\n', firstLineStart);
  if (firstLineEnd < 0) firstLineEnd = requestText.length;
  var firstLine = requestText.slice(firstLineStart, firstLineEnd);
  var body = firstLineEnd < requestText.length ? requestText.slice(firstLineEnd + 1) : '';
  var bodySeparator = firstLineEnd < requestText.length ? requestText.slice(firstLineEnd, firstLineEnd + 1) : '';
  return {
    leadEmptyLines: leadEmptyLines,
    firstLine: firstLine,
    bodySeparator: bodySeparator,
    body: body
  };
}