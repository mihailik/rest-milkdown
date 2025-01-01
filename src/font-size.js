// @ts-check

/**
 * @param {HTMLElement} host
 * @param {string} text
 * @param {boolean} [setToMinimal]
 */
export function updateFontSizeToContent(host, text, setToMinimal) {
  var fontSize = Math.min(calculateFontSizeToContent(host, text) || 0, 2.5);
  if (setToMinimal) fontSize = 1;

  var roundedFontSizeStr = !fontSize ? '' :
    (Math.round(fontSize * 2) * 50) + '%';
  if (host.style.fontSize !== roundedFontSizeStr) {
    if (host.style.fontSize) {
      const existingFontSize = Number(host.style.fontSize.replace('%', ''));
      if (existingFontSize > 0 && existingFontSize < 3) {
        if (!host.style.transition) host.style.transition = 'transform 200ms';
        setTimeout(() => {
          host.style.transform = 'scale(' + (fontSize / existingFontSize).toFixed(4) + ')';
          setTimeout(() => {
            host.style.fontSize = roundedFontSizeStr;
            setTimeout(() => {
              host.style.transform = '';
            }, 20);
          }, 180);
        }, 1);

        return true;
      }
    }

    console.log('adjusting font size: ' + host.style.fontSize + ' --> ' + roundedFontSizeStr);
    host.style.fontSize = roundedFontSizeStr;
    return true;
  }
}

/** @type {HTMLSpanElement} */
var invisibleSPAN;
/** @type {HTMLDivElement} */
var invisibleDIVParent;

/** @param {HTMLElement} host @param {string} text */
function calculateFontSizeToContent(host, text) {
  if (!text) return 2.5;

  if (!invisibleSPAN) {
    invisibleSPAN = document.createElement('span');
    invisibleDIVParent = document.createElement('div');
    invisibleDIVParent.appendChild(invisibleSPAN);
  }

  var textareaBounds = host.getBoundingClientRect();
  invisibleDIVParent.style.cssText =
    'position: absolute; left: -' + (textareaBounds.width * 2 | 0) + 'px; top: ' + (textareaBounds.height * 2 | 0) + 'px; ' +
    'padding: 1em; ' +
    'opacity: 0; pointer-events: none; z-index: -1000; ' +
    'white-space: pre-wrap; ';

  document.body.appendChild(invisibleDIVParent);
  invisibleSPAN.textContent = text;

  try {
    var measuredBounds = invisibleSPAN.getBoundingClientRect();
    var insetRatio = 0.6;

    if (measuredBounds.width * measuredBounds.height > textareaBounds.width * textareaBounds.height * 0.4)
      return; // too much text


    var horizontalRatio = measuredBounds.width / (textareaBounds.width * insetRatio);
    var verticalRatio = measuredBounds.height / (textareaBounds.height * insetRatio);
    if (horizontalRatio < 1 && verticalRatio < 1) {
      return Math.min(4, 1 / Math.max(horizontalRatio, verticalRatio));
    }

    if (verticalRatio < 1) {
      invisibleDIVParent.style.width = (measuredBounds.width * insetRatio) + 'px';

      measuredBounds = invisibleSPAN.getBoundingClientRect();

      horizontalRatio = measuredBounds.width / (textareaBounds.width * insetRatio);
      verticalRatio = measuredBounds.height / (textareaBounds.height * insetRatio);
      if (horizontalRatio <= 1 && verticalRatio < 1) {
        return Math.min(4, 1 / Math.max(horizontalRatio, verticalRatio));
      }
    }
  }
  catch (error) {
    console.error('Failing to adjust font size to content. ', error);
  }
  finally {
    document.body.removeChild(invisibleDIVParent);
    invisibleSPAN.textContent = '';
    invisibleDIVParent.style.width = '';
  }
}