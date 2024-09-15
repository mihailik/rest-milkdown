// @ts-check

import { $ctx, $view } from '@milkdown/utils';
// import { codeBlockSchema } from '@milkdown/preset-commonmark';

import { ProseMirrorCodeBlock } from './prose-mirror-code-block';
import { codeBlockSchema } from './schema';

import './code-block.css';

export const defaultConfig = {};
export const codeBlockConfig = $ctx(defaultConfig, 'codeBlockConfigCtx');


export const codeBlockView = $view(
  codeBlockSchema.node,
  (ctx) => {
    const config = ctx.get(codeBlockConfig.key)
    return (node, view, getPos) => new ProseMirrorCodeBlock(
      node,
      view,
      getPos,
      config,
    );
  });

