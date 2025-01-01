// @ts-check

import { thisScriptURL } from './url-encoded/parse-location';

export function likelyBookmarkletGetScriptSrc() {
  const thisScriptHost = thisScriptURL?.host;

  // script hosted in subdomain? looks like genuine app not bookmarklet
  if (location.host.indexOf(thisScriptHost || 'EMPTY::') >= 0 ||
    (thisScriptHost || '').indexOf(location.host || 'EMPTY::') >= 0) return false;

  const headElementCount = document.head.childElementCount;
  const bodyElementCount = document.body?.querySelectorAll('*')?.length || 0;

  // complex content
  return headElementCount > 4 && bodyElementCount > 10 ? thisScriptURL : undefined;
}

/**
 * @param {NonNullable<ReturnType<typeof likelyBookmarkletGetScriptSrc>>} scriptSrc 
 */
export function injectIframeAndExit(scriptSrc) {
  if (window['ifr']) return;
  const ifr = window['ifr'] = document.createElement('iframe');
  ifr.src = 'about:blank';
  const originalIframeCss = ifr.style.cssText = 'position:fixed;right:5vmin;top:5vmin;height:90vh;width:40vw;z-index:10000;border:solid 1px grey;border-radius: 0.4em;box-shadow:5px 5px 17px #00000052; background: white; opacity: 0.98;';
  document.body.appendChild(ifr);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'position:fixed;right:5vmin;top:1vmin;z-index:10001;height:3.8vmin;width: 3.8vmin;background: white;border - radius: 0.25em;border: solid 1px gray;border-radius:0.25em; opacity: 0.6;';
  document.body.appendChild(closeBtn);
  closeBtn.onclick = closeIframe;

  const maxBtn = document.createElement('button');
  maxBtn.textContent = '✥';
  maxBtn.style.cssText = 'position:fixed;right:9vmin;top:1vmin;z-index:10001;height:3.8vmin;width: 3.8vmin;background: white;border - radius: 0.25em;border: solid 1px gray;border-radius:0.25em; opacity: 0.6;';
  document.body.appendChild(maxBtn);
  maxBtn.onclick = maximizeCollapseIframe;

  const waitIframeLoadUntil = Date.now() + 10000;
  let waitForBody = setInterval(() => {
    if (Date.now() > waitIframeLoadUntil) return closeIframe();

    if (!ifr.contentDocument?.body) return;
    var scr = document.createElement('script');
    scr.src = scriptSrc.toString();
    ifr.contentDocument.body.appendChild(scr);
    clearInterval(waitForBody);
  }, 100);

  function closeIframe() {
    window['ifr'] = undefined;
    ifr?.remove();
    closeBtn?.remove();
    maxBtn?.remove();
  }

  var iframeMax;
  function maximizeCollapseIframe() {
    iframeMax = !iframeMax;
    if (iframeMax) {
      if (ifr) {
        ifr.style.width = '90vw';
        ifr.style.height = '90vh';
      }
    } else {
      if (ifr) ifr.style.cssText = originalIframeCss;
    }
  }
}