// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { registerRuntime } from '../state/runtime/plugin-runtime-service';
import { interpretString } from '../state/runtime/view/text/render-string';
import { parseHttpText } from './parse-http-text';

class HTTPRuntime {

  constructor() {
    /** @type {Map<string, Promise<any>>} */
    this.cachedRequests = new Map();
  }

  /**
   * @type {import('../state/runtime').ExecutionRuntime['parse']}
   */
  parse({ codeBlockRegions, editorState }) {
    this.codeBlockRegions = codeBlockRegions;
    this.editorState = editorState;

    const results = [];
    const newCachedRequests = new Map();
    for (let iBlock = 0; iBlock < codeBlockRegions.length; iBlock++) {
      const block = codeBlockRegions[iBlock];
      if (block.language !== 'HTTP') continue;

      results[iBlock] = { variables: undefined };
      const existingReq = this.cachedRequests.get(block.code);
      if (existingReq) newCachedRequests.set(block.code, existingReq);
    }

    return results;
  }

  /** @param {number} iBlock */
  async runCodeBlock(iBlock) {

    const block = this.codeBlockRegions?.[iBlock];
    if (block?.language !== 'HTTP' || !/\S/.test(block.code)) return;

    const req = this.cachedRequests.get(block.code);
    if (req) return req;

    const parsed = parseHttpText(block.code);
    if (!parsed) throw new Error('HTTP request is invalid.');

    const absoluteURL = new URL(parsed.firstLine.url)?.toString() || 'https://' + parsed.firstLine.url;
    const referrer = parsed.headers?.filter(h => (h.name || '').toLowerCase() === 'referrer')?.[0]?.value;
    const newReq = fetch(
      absoluteURL,
      {
        method: parsed.firstLine.verb,
        headers: parsed.headers.reduce((acc, h) => {
          if (h?.name) acc[h.name] = h.value;
          return acc;
        }, {}),
        body: parsed.body,
        referrer
      }).then(res => res.arrayBuffer()).then(arrayBuffer => {
        try {
          const textDecoder = new TextDecoder();
          const text = textDecoder.decode(new Uint8Array(arrayBuffer));
          const interpreted = interpretString(text);
          if (interpreted) return interpreted.parsed;
          else return text;
        } catch (err) {
          return arrayBuffer;
        }
      });

    this.cachedRequests.set(block.code, newReq);

    return newReq;
  }
}

const key = new PluginKey('HTTP_RUNTIME');
export const httpRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      registerRuntime(
        editorState,
        new HTTPRuntime());
    },
    apply: (tr, pluginState, oldState, newState) => undefined
  },
});
