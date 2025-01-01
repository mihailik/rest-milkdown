// @ts-check

import { isPromiseLike } from '../../../../../../async/throttled-async-cache';
import { safeGetProp } from '../../../../../../iframe-worker/serialize/remote-objects';
import { accessLanguageService } from '../../../../../../typescript-services';
import { renderArray } from './render-array';
import { likelyBinary, renderBinary } from './render-binary';
import { renderError } from './render-error';
import { likelyFetchResponse, renderFetchResponse } from './render-fetch-response';
import { renderFunction } from './render-function';
import { renderIterable } from './render-iterable';
import { renderObject } from './render-object';
import { renderBoolean, renderNumber, renderSymbol } from './render-primitives';
import { renderPromise } from './render-promise';
import { renderString } from './render-string';

/**
 * @param {import('.').ValueRenderParams} params
 * @returns {import('..').RenderedContent | import('..').RenderedContent[]}
 */
export function renderValue(params) {
  const { value, path, invalidate, state } = params;

  const rawValueType = typeof value;
  /** @type {(typeof rawValueType) | 'null' | 'array'} */
  let type = typeof value;
  if (type === 'undefined' && value !== undefined) type = 'object';
  if (type === 'object' && value === null) type = 'null';
  if (type === 'object' && Array.isArray(value)) type = 'array';

  switch (type) {
    case 'undefined':
    case 'null':
      params.wrap.availableHeight = Math.max(0, params.wrap.availableHeight - 1);
      return { class: 'hi-' + type, textContent: type };

    case 'string':
      return renderString(params);

    case 'number':
    case 'bigint':
      return renderNumber(params);

    case 'boolean':
      return renderBoolean(params);

    case 'symbol':
      return renderSymbol(params);

    case 'function':
      return renderFunction(params);

    case 'array':
      return renderArray(params);
  }

  if (!Array.isArray(value) && typeof value !== 'string' && (
    typeof safeGetProp(value, Symbol.iterator) === 'function' || typeof safeGetProp(value, Symbol.asyncIterator) === 'function'
  )) {
    return renderIterable(params);
  }

  if (typeof value === 'object' && value && value instanceof Error) {
    return renderError(params);
  }

  if (typeof value === 'object' && value && Array.isArray(value)) {
    return renderArray(params);
  }

  if (isPromiseLike(value)) {
    return renderPromise(params);
  }

  if (likelyFetchResponse(value)) {
    return renderFetchResponse(params);
  }

  if (likelyBinary(value)) {
    return renderBinary(params);
  }

  return renderObject(params);

  // try {
  //   const json = JSON.stringify(value, null, 2);
  //   if (!accessLang) {
  //     accessLang = accessLanguageService(invalidate);
  //     if (typeof accessLang.then === 'function') {
  //       accessLang.then(resolved => {
  //         accessLang = resolved;
  //         invalidate();
  //       });
  //     }
  //   }

  //   if (typeof accessLang.then === 'function') {
  //     return { class: 'success success-json', textContent: json.length > 20 ? json.slice(0, 13) + '...' + json.slice(-4) : json };
  //   }

  //   return renderJsonWithTS({ value: json, path, indent: '', invalidate, state }, accessLang);
  // } catch {
  //   try {
  //     return { class: 'success success-tostring', textContent: String(value) };
  //   } catch (toStringError) {
  //     return { class: 'success success-tostring-error', textContent: toStringError.message.split('\n')[0] };
  //   }
  // }
}

/** @type {ReturnType<typeof accessLanguageService> | undefined} */
var accessLang;
