// @ts-check

import { renderComposite } from './render-composite';
import { renderElement } from './render-element';

import './render-node.css';

/**
 * @param {import('.').ValueRenderParams<import('../../../../../../iframe-worker/serialize/remote-objects').SerializedDOMNode>} params
 */
export function renderNode(params) {
  if (params.value.nodeType === 'TEXT') {
    const simpleText = /\S/.test(params.value.textContent);
    return {
      class: simpleText ? 'hi-node-text' : 'hi-node-text hi-node-text-json',
      textContent:
        simpleText ? params.value.textContent :
          JSON.stringify(params.value.textContent)
    };
  } else if (params.value.nodeType === 'DOCUMENT_FRAGMENT') {
    // fragments behave pretty much like a whole HTML element
    return renderElement(/** @type {*} */(params));
  }

  return renderComposite(params);
}
