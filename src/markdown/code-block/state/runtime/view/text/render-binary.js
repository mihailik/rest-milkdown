// @ts-check

import { renderString } from './render-string';

/**
 * @param {import('.').ValueRenderParams<any>} params
 */
export function renderBinary(params) {
  const { value, path, indent: originialIndent, wrap, invalidate, state } = params;

  // TODO: detect text/UTF8 (and its sub-formats)
  // TODO: detect images
  // TODO: detect gzip and other blob-compressing formats
  // TODO: detect ZIP (and XLSX/DOCX sub-formats)
  // TODO: detect DOC/XLS (old)
  // TODO: detect RTF
  // TODO: detect EXE/DLL (PE)
  // TODO: detect JAR
  // TODO: detect WASM binaries (how? what??)
  // TODO: detect CAR/CBOR

  const bin = likelyBinary(value);
  if (!bin) return '?binary??';

  const textDecoder = new TextDecoder();
  const text = textDecoder.decode(
    Array.isArray(bin) ? new Uint8Array(bin) :
    bin
  );

      const lead = { class: 'hi-bin-mark-start', textContent: 'bin/' };
      const trail = { class: 'hi-bin-mark-end', textContent: '/bin' };
    
  const renderResult = renderString({
    ...params,
    path: path + '.decode()',
    value: text
  });

  if (Array.isArray(renderResult)) return [lead, ...renderResult, trail];
  else return [lead, renderResult, trail];
}

const OtherIntegerArrays = [
  Uint8ClampedArray, Uint16Array, Uint32Array,
  Int8Array, Int16Array, Int32Array
];

/** @param {any} value */
export function likelyBinary(value) {
  if (!value) return;

  if (typeof value !== 'object') return;

  if (Array.isArray(value)) return likelyArrayOfByteNumbers(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);

  for (let i = 0; i < OtherIntegerArrays.length; i++) {
    if (value instanceof OtherIntegerArrays[i]) return createIntegerArrayAccess(value);
  }
}

/** @param {InstanceType<typeof OtherIntegerArrays[number]>} value */
function createIntegerArrayAccess(value) {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** @param {number[]} arr */
function likelyArrayOfByteNumbers(arr) {
  if (!arr.length) return;

  const max = Math.min(4000, arr.length);
  for (let i = 0; i < max; i++) {
    const num = arr[i];
    const isByte = num < 256 && num > 0 && (num | 0) === num;
    if (!isByte) return;
  }

  return arr;
}
