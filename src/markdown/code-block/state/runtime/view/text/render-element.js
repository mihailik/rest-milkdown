// @ts-check

import { renderComposite } from './render-composite';
import { renderValue } from './render-value';
import { formatTagWidget } from './format-tags';

import './render-element.css';
import { loadCorsIframe } from '../../../../../../iframe-worker/load-cors-iframe';

/**
 * @param {import('.').ValueRenderParams<import('../../../../../../iframe-worker/serialize/remote-objects').SerializedElement>} params
 */
export function renderElement(params) {
  const toggleWidget = formatTagWidget({
    ...params,
    json: (params) => {
      return renderComposite(params);
    },
    formats: {
      tree: createDOMTreeFormatter,
      visual: createDOMVisualFormatter
    }
  });

  const output = toggleWidget(params);
  if (toggleWidget.view === 'tree') {
    const domOutput = renderElementAsDOM(params);
    if (Array.isArray(domOutput)) output.push(...domOutput);
    else output.push(domOutput);
  }

  return output;

  function createDOMTreeFormatter() {
    const btn = document.createElement('span');
    btn.textContent = '</>';

    return apply;

    function apply() {
      return {
        preference: 1,
        button: btn,
        render: () => undefined
      };
    }
  }

  function createDOMVisualFormatter() {
    const btn = document.createElement('span');
    btn.textContent = '👁️';

    return apply;

    /** @param {import('.').ValueRenderParams} _ */
    function apply({ value }) {
      return {
        preference: (value.tagName || '').toUpperCase() === 'STYLE' ? 0.8 : 2,
        button: btn,
        render: () => {
          /**
           * @type {{
           *  wrapper: HTMLElement,
           *  bounds: { width: number, height: number }
           * }}
           */
          const preservedIframe = params.state[params.path + '.iframe'];
          let iframeWrapper;
          if (preservedIframe) {
            iframeWrapper = preservedIframe.wrapper;
          } else {
            iframeWrapper = document.createElement('div');
            iframeWrapper.className = 'hi-element-visual-iframe-wrapper';
          }

          setTimeout(async () => {
            iframeWrapper.textContent = '';
            const { iframe, origin: iframeOrigin } = await loadCorsIframe({
              origin: value.origin,
              parent: iframeWrapper
            });

            const callKey = 'presentVisual:' + Date.now() + ':' + Math.random();

            window.addEventListener('message', handleMessage);

            iframe.contentWindow?.postMessage(
              {
                presentVisual: {
                  domAccessKey: value.domAccessKey,
                  contextMarker: value.contextMarker || value.tagName, callKey
                }
              },
              { targetOrigin: value.origin });

            iframe.style.opacity = '1';
            iframe.style.pointerEvents = 'all';
            iframe.style.height = '3em';

            function handleMessage({ data, origin, source }) {
              if (iframeOrigin !== '*' && origin !== iframeOrigin) return;
              if (source !== iframe.contentWindow) return;

              if (data.presentVisualReply?.callKey === callKey) {
                window.removeEventListener('message', handleMessage);

                if (data.presentVisualReply.bounds) {
                  iframe.style.width = '100%';
                  iframe.style.height = '100%';

                  iframeWrapper.style.width = Math.min(
                    1000,
                    Math.max((data.presentVisualReply.bounds.width || 0) + 2.5, 16)
                  ) + 'px';

                  iframeWrapper.style.height = Math.min(
                    800,
                    Math.max((data.presentVisualReply.bounds.height || 0) + 2.5, 16)
                  ) + 'px';
                }

                params.state[params.path + '.iframe'] = {
                  wrapper: iframeWrapper,
                  iframe,
                  origin: iframeOrigin,
                  bounds: data.presentVisualReply.bounds
                };
              }
            }
          }, 1);

          return iframeWrapper;
        }
      }
    }
  }
}

const MAX_TAG_LINE_LENGTH = 150;

/**
 * @param {import('.').ValueRenderParams<import('../../../../../../iframe-worker/serialize/remote-objects').SerializedElement>} params
 */
export function renderElementAsDOM(params) {
  const posTag = (params.value.openingLine?.toLowerCase() || '').indexOf(params.value.tagName?.toLowerCase() || '');
  if (!params.value.tagName || posTag < 0) return renderComposite(params);

  const preLeadText = params.value.openingLine.slice(0, posTag);
  const tag = params.value.tagName.toLowerCase();
  const postTagLead = params.value.openingLine.slice(posTag + tag.length);

  /** @type {(import('..').RenderedContent)[]} */
  const output = [
    {
      widget: () => {
        const btn = document.createElement('button');
        btn.className = 'hi-element-pre-opening-tag';
        btn.textContent = preLeadText;
        btn.onclick = () => {
          btn.textContent = '...loading ' + preLeadText;
          const iframe = document.createElement('iframe');

        };
        return btn;
      }
    },
    { class: 'hi-element-opening-tag', textContent: tag }
  ];

  if (postTagLead.length <= MAX_TAG_LINE_LENGTH) {
    output.push({
      class:
        params.value.childCount ? 'hi-element-post-opening-tag' :
          'hi-element-post-opening-and-closing-tag',
      textContent: postTagLead
    });
  } else {
    const lead = postTagLead.slice(0, Math.floor(MAX_TAG_LINE_LENGTH * 0.6));
    const trail = postTagLead.slice(postTagLead.length - (MAX_TAG_LINE_LENGTH - lead.length - 1));

    output.push({
      class:
        params.value.childCount ? 'hi-element-post-opening-tag-lead' :
          'hi-element-post-opening-and-closing-tag-lead',
      textContent: lead
    });

    output.push({
      class:
        params.value.childCount ? 'hi-element-post-opening-tag-ellipsis' :
          'hi-element-post-opening-and-closing-tag-ellipsis',
      textContent: '...'
    });

    output.push({
      class:
        params.value.childCount ? 'hi-element-post-opening-tag' :
          'hi-element-post-opening-and-closing-tag',
      textContent: trail
    });
  }

  if (params.value.childCount) {
    const children = params.state[params.path + '.children'];
    const visualIframe = params.state[params.path + '.iframe'];
    const showIframe = params.state[params.path + '.showIframe'];
    if (showIframe) {
      if (!visualIframe) {
        output.push({
          widget: () => {
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.textContent = '... loading';
            return ellipsisSpan;
          }
        });
      } else {
        output.push({
          widget: () => {
            return visualIframe;
          }
        });
      }
    }

    if (!children) {
      output.push(
        {
          widget: () => {
            const btn = document.createElement('button');
            btn.className = 'hi-element-child-count';
            btn.textContent = '...[' + params.value.childCount.toLocaleString() + ']';
            btn.onclick = async () => {
              if (params.value.getChildren) {
                btn.textContent = '...[' + params.value.childCount.toLocaleString() + '] . . . '
                params.invalidate();
                const children = await params.value.getChildren();
                params.state[params.path + '.children'] = children;
                params.invalidate();
              }
            };
            return btn;
          }
        });
    } else {
      if (children.length) {
        for (let iChild = 0; iChild < children.length; iChild++) {
          const child = children[iChild];
          output.push('\n    ' + params.indent);
          const renderer =
            child && child.___kind === 'Element' ? renderElementAsDOM :
              renderValue;
          const childOutput = renderer({
            ...params,
            path: params.path + '.children[' + iChild + ']',
            indent: params.indent + '    ',
            value: child
          });

          if (childOutput) {
            if (Array.isArray(childOutput)) output.push(...childOutput);
            else output.push(childOutput);
          }
        }
        output.push('\n' + params.indent);
      }
    }

    output.push({ class: 'hi-element-pre-closing-tag', textContent: '</' });
    output.push({ class: 'hi-element-closing-tag', textContent: tag });
    output.push({ class: 'hi-element-post-closing-tag', textContent: '>' });
  }

  return output;
}