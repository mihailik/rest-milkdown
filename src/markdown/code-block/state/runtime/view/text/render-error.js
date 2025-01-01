// @ts-check

import './render-error.css';

/**
 * @param {import('.').ValueRenderParams} params
 */
export function renderError(params) {
  const { value, path, invalidate, state } = params;

  /** @type {(import('..').RenderedContent)[]} */
  const output = [];
  const error = value;
  if (!error || !(error instanceof Error)) {
    output.push({ class: 'hi-obj-error hi-obj-error-exotic', textContent: typeof error + ' ' + JSON.stringify(error) });
  } else {
    let wholeText = String(error).length > (error.stack || '').length ? String(error) : (error.stack || '');

    let title = wholeText.split('\n')[0];
    let subtitle = '';
    let details = wholeText.slice(title.length);

    if (title.indexOf(error.message) >= 0) {
      title = title.slice(0, title.indexOf(error.message));
      subtitle = error.message;
    } else if (error.message && error.message.length && (!title.length || title.length < error.message.length)) {
      title = error.message.split('\n')[0];
      subtitle = error.message.slice(title.length + 1);
    }

    if (title)
      output.push({ class: 'hi-obj-error hi-obj-error-title', textContent: title });
    if (subtitle)
      output.push({ class: 'hi-obj-error hi-obj-error-subtitle', textContent: subtitle });

    const errorExpanded = state[path + '.errorExpanded'];

    output.push({
      widget: () => {
        const infoButton = document.createElement('button');
        infoButton.className = 'hi-obj-error hi-obj-error-info-button';
        infoButton.textContent = 'i';
        infoButton.onclick = () => {
          state[path + '.errorExpanded'] = !errorExpanded;
          invalidate();
        };
        return infoButton;
      }
    });

    if (details && errorExpanded) {
      output.push({ class: 'hi-obj-error hi-obj-error-details', textContent: details });
    }
  }

  params.wrap.availableHeight = Math.max(0, params.wrap.availableHeight - 1);
  return output;
}