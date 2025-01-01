// @ts-check

import { version } from '../package.json';
import { gitInfo } from './runtime-git-info';

import { injectIframeAndExit, likelyBookmarkletGetScriptSrc } from './bookmarklet';
import { runMarkdown } from './markdown';
import { parseLocation } from './url-encoded/parse-location';
import { parsePathPayload } from './url-encoded/parse-path-payload';

// @ts-ignore
import indexHTML from './index.html';
// @ts-ignore
import initHTML from './init.html';
// @ts-ignore
import favicon from '../mockument-128.png';

export function runInteractiveApp() {
  document.body.spellcheck = false;
  const urlData = parseLocation();
  const payload = parsePathPayload(urlData.payload);
  let verbEditMode = payload.impliedVerb ? '' : payload.verb;

  let contentHost = /** @type {HTMLElement} */(document.getElementById('contentHost'));
  if (!contentHost || !/div/i.test(document.getElementById('main')?.tagName || '')) {
    document.getElementById('main')?.remove();
    const bookmarkletScriptSrc = likelyBookmarkletGetScriptSrc();
    if (bookmarkletScriptSrc) {
      return injectIframeAndExit(bookmarkletScriptSrc);
    }
    injectDocumentHTML();
    contentHost = /** @type {HTMLElement} */(document.getElementById('contentHost'));
  }

  [...document.querySelectorAll('link[rel=icon]')].forEach(x => x.remove());

  const faviconDataURI = 
    'data:image/png;base64,' + btoa([...favicon].map(x => String.fromCharCode(x)).join(''));
  console.log({ favicon, faviconDataURI });
  const faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  faviconLink.setAttribute('sizes', 'any');
  faviconLink.href = faviconDataURI;
  document.head.appendChild(faviconLink);

  const versionDIV = document.getElementById('version');
  if (versionDIV) {
    versionDIV.textContent = 'v' + version;
    if (gitInfo.runtime_git_info?.length) {
      versionDIV.title = gitInfo.runtime_git_info[0].subject;
      const formattedSimple =
        'Recent updates:\n' +
        gitInfo.runtime_git_info.map(
          entry => '  #' + entry.hash + ' ' + entry.author + ' ' + entry.date + ' ' + entry.subject
        ).join('\n');

      versionDIV.onclick = () => alert(formattedSimple);
    }
  }

  let format_textarea = /** @type {HTMLTextAreaElement} */(document.getElementById('format_textarea'));
  const tools = document.getElementById('tools');

  const originalText = [payload.addr, payload.body].filter(Boolean).join('\n') || format_textarea?.value || '';
  contentHost.innerHTML = '';

  runMarkdown(
    contentHost,
    originalText);

}

export function injectDocumentHTML() {
  const lastScriptSrc = Array.from(document.scripts).slice(-1)[0]?.src;
  if (!document.body) {
    const body = document.createElement('body');
    document.documentElement.appendChild(body);
  }

  const ifr = document.createElement('iframe');
  ifr.src = 'about:blank';
  ifr.style.cssText = 'pointer-events: none; opacity: 0;';
  document.body.appendChild(ifr);

  ifr.contentDocument?.write(indexHTML);
  addChildren(ifr.contentDocument?.head, document.head);
  addChildren(ifr.contentDocument?.body, document.body);

  const bigCss = document.createElement('link');
  bigCss.rel = 'stylesheet';
  bigCss.href = lastScriptSrc.replace(/\.js$/i, '.css');
  document.head.appendChild(bigCss);

  if (!ifr.contentDocument?.body) {
    /** @type {typeof document} */(ifr.contentDocument).documentElement.appendChild(
      /** @type {typeof document} */(ifr.contentDocument).createElement('body'));
  }

  /** @type {typeof document} */(ifr.contentDocument).body.innerHTML = initHTML;

  addChildren(ifr.contentDocument?.body, document.body);

  ifr.remove();

  /**
   * @param {HTMLElement | undefined} sourceElem
   * @param {HTMLElement} targetElem
   */
  function addChildren(sourceElem, targetElem) {
    if (!sourceElem) return;
    for (const elem of Array.from(sourceElem.children || [])) {
      if (/style/i.test(elem.tagName || '') || /script/i.test(elem.tagName || '')) continue;
      const cloneElem = /** @type {HTMLElement & { src?: string, href?: string }} */(elem.cloneNode());
      cloneElem.innerHTML = elem.innerHTML;
      const src = cloneElem.getAttribute('src');
      const href = cloneElem.getAttribute('href')
      if (src) cloneElem.src = adjustSrcRoot(src);
      if (href) cloneElem.href = adjustSrcRoot(href);

      targetElem.appendChild(cloneElem);
    }
  }

  /** @param {string} src */
  function adjustSrcRoot(src) {
    if (/^http(s?)\:/i.test(src)) return src;
    const baseSrc = lastScriptSrc.replace(/\/[^\/]+$/, '/');
    const combined = baseSrc + src.replace(/^\.*\/*/, '');
    console.log('expanded ', src, ' on ', lastScriptSrc, ' to ', combined);
    return combined;
  }
}