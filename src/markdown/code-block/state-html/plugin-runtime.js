// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { registerJSRuntimePreprocessor } from '../state-javascript/plugin-runtime';

export const ASSOCIATED_CSS_TAG = '___associatedCSS';
export const BACKUP_CHILD_NODES_TAG = '___backupChildNodes';

const key = new PluginKey('HTML_RUNTIME');
export const htmlRuntimePlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      registerJSRuntimePreprocessor(
        editorState,
        ({ codeBlockRegions, editorState }) => {
          const allCSS = codeBlockRegions.map((block, iBlock) => {
            const cssFileName = cssBlockFilename(iBlock, block.language, block.langSpecified);
            if (cssFileName) return '/** ' + cssFileName + ' **/\n' + block.code;
          }).filter(Boolean).join('\n\n');

          return codeBlockRegions.map((block, iBlock) => {
            const htmlFileName = htmlBlockFilename(iBlock, block.language, block.langSpecified);
            const html = block.code.trim();
            if (htmlFileName) return {
              fileName: htmlFileName,
              text: htmlCodeToJavaScriptCreateElement({ html, fileName: htmlFileName, allCSS })
            };

            const cssFileName = cssBlockFilename(iBlock, block.language, block.langSpecified);
            if (cssFileName) return {
              fileName: cssFileName,
              text:
                '(() => { \n' +
                'const wrapper = document.createElement("style");\n' +
                'wrapper.innerHTML = ' + JSON.stringify(block.code.trim()) + ';\n' +
                // make sure hard reference is stored in document, so DOM elements are not snapped by GC
                'return document["' + cssFileName + '"] = wrapper;\n' +
                '})()'
            };
          });
        });
    },
    apply: (tr, pluginState, oldState, newState) => pluginState
  },
});

/**
 * @param {{
 *  html: string,
 *  fileName: string,
 *  allCSS: string,
 * }} _
 */
export function htmlCodeToJavaScriptCreateElement({ html, fileName, allCSS }) {
  return (
    '(() => { \n' +
    '  let elem = document["' + fileName + '"];\n' +
    '  try { if (elem?.parentElement === document.body) { elem.remove() } } catch (removeError) {}\n' +
    '  elem = document.createElement("div");\n' +
    '  elem.innerHTML = ' + JSON.stringify(html) + '; try { throw new Error(123); } catch (err) {}\n' +
    '  if (elem.childNodes.length === 1) elem = elem.childNodes[0];\n' +
    '  else {\n' +
    '    const wrapper = document.createDocumentFragment();\n' +
    '    wrapper["' + BACKUP_CHILD_NODES_TAG + '"] = [...elem.childNodes];\n' +
    '    for (const child of [...elem.childNodes]) {\n' +
    '      if ((child.tagName || "").toLowerCase() === "script" && !child.scr) {\n' +
    '        const newScript = document.createElement("script");\n' +
    '        newScript.innerHTML = child.innerHTML;\n' +
    '        for (const attr of child.attributes) { newScript.setAttribute(attr.name, attr.value); };\n' +
    '        wrapper.appendChild(newScript);\n' +
    '      } else {\n' +
    '        wrapper.appendChild(child);\n' +
    '      }\n' +
    '    };\n' +
    '    elem = wrapper;\n' +
    '  }\n' +
    '  // make sure hard reference is stored in document, so DOM elements are not snapped by GC\n' +
    '  document["' + fileName + '"] = elem;\n' +
    (
      !allCSS ? '' :
        '  elem.' + ASSOCIATED_CSS_TAG + ' = ' + JSON.stringify(allCSS) + ';\n'
    ) +
    '  try { document.body.appendChild(elem); } catch (appendError) {}\n' +
    '  return elem;\n' +
    '})()'
  );
}

/**
 * @param {number} iBlock
 * @param {string | null | undefined} language
 * @param {string | null | undefined} langSpecified
 */
export function htmlBlockFilename(iBlock, language, langSpecified) {
  if (language === 'HTML') return 'HTML-' + iBlock + '.html.js';
}

/**
 * @param {number} iBlock
 * @param {string | null | undefined} language
 * @param {string | null | undefined} langSpecified
 */
export function cssBlockFilename(iBlock, language, langSpecified) {
  if (language === 'CSS') return 'CSS-' + iBlock + '.css.js';
}
