// @ts-check

import { renderError } from './render-error';
import { renderValue } from './render-value';

/** @type {WeakMap<any, { success: boolean, result: any }>} */
const promiseResolutions = new WeakMap();

/**
 * @param {import('.').ValueRenderParams<Promise<any>>} params
 */
export function renderPromise(params) {
  const { value, path, indent: originialIndent, wrap, invalidate, state } = params;

  let resolution = promiseResolutions.get(value);
  if (!resolution) {
    value.then(
      resolved => {
        promiseResolutions.set(value, { success: true, result: resolved });
        invalidate();
      },
      error => {
        promiseResolutions.set(value, { success: true, result: error });
        invalidate();
      });
    
    return [
      { class: 'hi-promise-mark-start', textContent: 'Promise...' }
    ];
  }

    const lead = { class: 'hi-fetch-mark-start', textContent: 'fetch:' };
    const trail = { class: 'hi-fetch-mark-end', textContent: ':fetch' };
  
    const renderResult = resolution.success ?
      renderValue({ ...params, path: path + '.then()', value: resolution.result }) :
      renderError({ ...params, path: path + '.catch()', value: resolution.result });
  
    if (Array.isArray(renderResult)) return [lead, ...renderResult, trail];
    else return [lead, renderResult, trail];
}
