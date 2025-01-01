// @ts-check

import { thisScriptURL } from '../url-encoded/parse-location';

/**
 * @param {{
 *  origin?: string,
 *  parent?: HTMLElement
 * }} [params]
 * @returns {Promise<{ iframe: HTMLIFrameElement, origin: string }>}
 */
export function loadCorsIframe(params) {
  return new Promise(async (resolveIframe, rejectIframe) => {
    const workerIframeCandidate = document.createElement('iframe');
    workerIframeCandidate.style.cssText =
      (params?.parent ? '' : 'position: absolute; left: -200px; top: -200px; width: 220px; height: 220px; ') +
      ' pointer-events: none; opacity: 0.01; border: none; padding: 0; margin: 0; background: transparent;';
    
    let childOrigin;
    let iframeSrc;
    const ackKey = 'init:' + Date.now() + ':' + Math.random().toString(36).slice(1).replace(/[^a-z0-9]/ig, '');

    const selfHosted =
      /http/i.test(location.protocol || '') && thisScriptURL?.host === location.host;

    if (params?.origin) {
      childOrigin = params.origin;
      iframeSrc = selfHosted ? params.origin : params.origin + (params.origin.endsWith('/') ? '' : '/') + 'origin/' + window.origin;
    } else {
      const ifrWrk = Math.random().toString(36).slice(1).replace(/[^a-z0-9]/ig, '') + '-ifrwrk.';

      childOrigin =
        !selfHosted ? 'https://' + ifrWrk + 'tty.wtf' :
          window.origin.replace(location.host, ifrWrk + location.host);

      iframeSrc =
        !selfHosted ? 'https://' + ifrWrk + 'tty.wtf/origin/' + window.origin :
          location.protocol + '//' + ifrWrk + location.host;
    }

    workerIframeCandidate.src = iframeSrc;

    workerIframeCandidate.onload = async () => {
      const pollUntil = Date.now() + 35000;
      while (true) {
        if (workerIframeCandidate.contentWindow) break;
        if (Date.now() > pollUntil) {
          rejectIframe(new Error('IFRAME load timeout after ' + (Date.now() - pollUntil) + 'msec.'));
          setTimeout(() => {
            workerIframeCandidate.remove();
          }, 1000);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let initialized = false;
      window.addEventListener('message', handleIframeMessage);

      while (!initialized) {
        // keep polling
        workerIframeCandidate.contentWindow.postMessage(
          {
            init: new Date() + '',
            ackKey
          },
          childOrigin);

        if (Date.now() > pollUntil) {
          rejectIframe(new Error('IFRAME init timeout after ' + (Date.now() - pollUntil) + 'msec.'));
          setTimeout(() => {
            workerIframeCandidate.remove();
          }, 1000);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      function handleIframeMessage({ data, origin, source }) {
        if (childOrigin !== '*' && origin !== childOrigin) return;
        if (source !== workerIframeCandidate.contentWindow) return;

        if (data.init === 'ack' && data.ackKey === ackKey) {
          initialized = true;
          window.removeEventListener('message', handleIframeMessage);
          resolveIframe({ iframe: workerIframeCandidate, origin: childOrigin });
        }
      }
    };

    workerIframeCandidate.onerror = (iframeError) => {
      console.log('IFRAME ', iframeError);
      rejectIframe(iframeError);

      setTimeout(() => {
        workerIframeCandidate.remove();
      }, 1000);
    };

    (params?.parent || document.body).appendChild(workerIframeCandidate);
  });
}