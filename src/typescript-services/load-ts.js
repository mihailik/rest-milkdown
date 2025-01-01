// @ts-check

/**
 * @type {import('typescript') & { then?: never } | Promise<import('typescript')> | undefined}
 */
var ts;

export function loadTS() {
  if (ts) return ts;

  return ts = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      location.hostname === 'localhost' ?
        './node_modules/typescript/lib/typescript.js' :
        'https://cdn.jsdelivr.net/npm/typescript';

    script.onload = () => {
      resolve(ts = window['ts']);
      setTimeout(() => {
        script.remove();
      }, 1000);
    };
    script.onerror = (x) => {
      reject(x);
      setTimeout(() => {
        script.remove();
      }, 1000);
    };
    (document.body || document.head).appendChild(script);
  });

}
