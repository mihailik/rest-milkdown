// @ts-check

import { isPromiseLike } from '../../../../../../async/throttled-async-cache';
import { renderBinary } from './render-binary';
import { renderError } from './render-error';

/** @type {WeakMap<any, Promise<ArrayBuffer> | { success: true, result: ArrayBuffer } | { success: false, result: any }>} */
const arrayBufferOfResponse = new WeakMap();

/**
 * @param {import('.').ValueRenderParams<Awaited<ReturnType<typeof fetch>>>} params
 */
export function renderFetchResponse(params) {
  const { value, path, invalidate } = params;

  let arrayBufferCallEntry = arrayBufferOfResponse.get(value);

  if (!arrayBufferCallEntry) {
    arrayBufferCallEntry = value.arrayBuffer();
    arrayBufferOfResponse.set(value, arrayBufferCallEntry);
  }

  if (isPromiseLike(arrayBufferCallEntry)) {
    /** @type {Promise} */(arrayBufferCallEntry).then(
      resolved => {
        arrayBufferOfResponse.set(value, { success: true, result: resolved });
        invalidate();
      },
      error => {
        arrayBufferOfResponse.set(value, { success: true, result: error });
        invalidate();
      });
    
    return [
      { class: 'hi-fetch-mark-start', textContent: 'fetching' },
      { class: 'hi-fetch-mark-end', textContent: '...' }
    ];
  }

  const lead = { class: 'hi-fetch-mark-start', textContent: 'fetch:' };
  const trail = { class: 'hi-fetch-mark-end', textContent: ':fetch' };

  const renderResult = arrayBufferCallEntry.success ?
    renderBinary({ ...params, path: path + '.arrayBuffer()', value: arrayBufferCallEntry.result }) :
    renderError({ ...params, path: path + '.arrayBuffer()', value: arrayBufferCallEntry.result });

  if (Array.isArray(renderResult)) return [lead, ...renderResult, trail];
  else return [lead, renderResult, trail];
}

export function likelyFetchResponse(value) {
  try {
    return (
      typeof value === 'object' && value &&
      typeof value.arrayBuffer === 'function' &&
      typeof value.json === 'function' &&
      typeof value.text === 'function'
    );
  } catch (err) {
  }
}
