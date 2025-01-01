// @ts-check

import { renderComposite } from './render-composite';
import { renderElement } from './render-element';
import { renderNode } from './render-node';

/**
 * @param {import('.').ValueRenderParams<any>} params
 */
export function renderObject(params) {
  switch (params.value.___kind) {
    case 'Element':
      return renderElement(params);
    case 'Node':
      return renderNode(params);
  }

  return renderComposite(params);
}