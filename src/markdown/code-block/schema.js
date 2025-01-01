// @ts-check

import { expectDomTypeError } from '@milkdown/exception';
import { $nodeSchema } from '@milkdown/utils';

export const codeBlockBackTickLanguage = $nodeSchema('code_block_backtick_language', (ctx) => {
  return {
    content: 'text*',
    group: 'block',
    marks: '',
    // defining: true,
    // isolating: true,
    toDOM: () => [
      'div',
      { class: 'code_block_backtick_language' },
      ['span', { class: 'backtick' }, 0]
    ],
    parseDOM: [
      { tag: 'div' }
    ],
    parseMarkdown: {
      match: () => false,
      runner: () => {
      }
    },
    toMarkdown: {
      match: () => false,
      runner: () => {
      }
    }
  };
});

export const codeBlockScript = $nodeSchema('code_block_script', (ctx) => {
  return {
    content: 'text*',
    group: 'block',
    marks: '',
    code: true,
    defining: true,
    isolating: true,
    toDOM: () => [
      'pre',
      { class: 'code_block_script' },
      0
    ],
    parseDOM: [
      { tag: 'pre', preserveWhitespace: 'full' }
    ],
    parseMarkdown: {
      match: () => false,
      runner: () => {
      }
    },
    toMarkdown: {
      match: () => false,
      runner: () => {
      }
    }
  };
});

export const codeBlockExecutionState = $nodeSchema('code_block_execution_state', (ctx) => {
  return {
    content: 'text?',
    group: 'block',
    marks: '',
    // defining: true,
    // isolating: true,
    toDOM: (node) => [
      'div',
      { class: 'code_block_execution_state' },
      0
    ],
    parseDOM: [
      { tag: 'div' }
    ],
    parseMarkdown: {
      match: () => false,
      runner: () => {
      }
    },
    toMarkdown: {
      match: () => false,
      runner: () => {
      }
    }
  };
});

export const customCodeBlockSchema = $nodeSchema('code_block', (ctx) => {
  return {
    content: 'code_block_backtick_language code_block_script code_block_execution_state',
    group: 'block',
    allowGapCursor: true,
    isolating: true,
    marks: '',
    definingForContent: true,
    code: true,
    attrs: { phase: { default: '' } },
    draggable: true,
    toDOM: node => {
      // console.log('toDOM ', node);
      return [
        'div',
        {
          class: 'code_block code-block-' + node.attrs.phase
        },
        0]
    },
    parseDOM: [
      { tag: 'pre', preserveWhitespace: 'full' },
      { tag: 'div.code_block' }
    ],
    parseMarkdown: {
      match: mdNode => mdNode.type === 'code',
      runner: (parserState, mdNode, proseMirrorNodeType) => {
        parserState.openNode(proseMirrorNodeType);

        parserState.openNode(codeBlockBackTickLanguage.type(ctx))
        if (typeof mdNode.lang === 'string' && mdNode.lang)
          parserState.addText(mdNode.lang);
        parserState.closeNode();

        parserState.openNode(codeBlockScript.type(ctx))
        if (typeof mdNode.value === 'string' && mdNode.value)
          parserState.addText(mdNode.value);
        parserState.closeNode();

        parserState.openNode(codeBlockExecutionState.type(ctx))
        parserState.closeNode();
        parserState.closeNode();
      }
    },
    toMarkdown: {
      match: mdNode => mdNode.type.name === 'code_block',
      runner: (state, proseMirrorNode) => {
        let script = '';
        let lang = '';
        for (let iChild = 0; iChild < proseMirrorNode.content.childCount; iChild++) {
          const child = proseMirrorNode.content.child(iChild);
          if (child.type.name === 'code_block_script')
            script = child.textContent;
          if (child.type.name === 'code_block_backtick_language')
            lang = child.textContent;
        }
        state.addNode(
          'code',
          undefined,
          script,
          { lang });
      }
    }
  };
});
